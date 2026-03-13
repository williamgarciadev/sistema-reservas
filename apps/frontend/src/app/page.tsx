export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">
        Sistema de Reservas de Citas
      </h1>
      <p className="text-xl text-center max-w-2xl">
        Bienvenido al sistema de reservas. Inicia sesión o regístrate para comenzar.
      </p>
      <div className="mt-8 flex gap-4">
        <a 
          href="/login" 
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Iniciar Sesión
        </a>
        <a 
          href="/registro" 
          className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
        >
          Registrarse
        </a>
      </div>
    </main>
  );
}
