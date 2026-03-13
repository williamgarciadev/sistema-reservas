import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from 'shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    this.client.interceptors.request.use(this.handleRequest.bind(this));
    this.client.interceptors.response.use(
      (response) => response,
      this.handleResponseError.bind(this)
    );
  }

  private handleRequest(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    const token = this.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }

  private async handleResponseError(error: AxiosError<ApiError>): Promise<any> {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (this.isRefreshing) {
        return new Promise((resolve, reject) => {
          this.failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this.client(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      this.isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { token: newToken, refreshToken: newRefreshToken } = response.data.data;
        this.setToken(newToken, newRefreshToken);

        this.failedQueue.forEach(({ resolve }) => resolve(newToken));
        this.failedQueue = [];

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return this.client(originalRequest);
      } catch (refreshError) {
        this.failedQueue.forEach(({ reject }) => reject(refreshError as Error));
        this.failedQueue = [];
        this.logout();
        return Promise.reject(refreshError);
      } finally {
        this.isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  private setToken(token: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
  }

  public logout(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  }

  public getClient(): AxiosInstance {
    return this.client;
  }

  // Wrapper methods for direct use
  public post<T>(url: string, data?: any) {
    return this.client.post<T>(url, data);
  }

  public get<T>(url: string) {
    return this.client.get<T>(url);
  }

  public put<T>(url: string, data?: any) {
    return this.client.put<T>(url, data);
  }

  public patch<T>(url: string, data?: any) {
    return this.client.patch<T>(url, data);
  }

  public delete<T>(url: string) {
    return this.client.delete<T>(url);
  }
}

export const apiClient = new ApiClient();
export default apiClient.getClient();
