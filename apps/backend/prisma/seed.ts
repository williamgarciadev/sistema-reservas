import { PrismaClient, Rol, EstadoCita, TipoDisponibilidad } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Helper function to hash passwords
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Helper function to create time slots
function getTimeSlots(date: Date, slots: string[]): Date[] {
  return slots.map(time => {
    const [hours, minutes] = time.split(':').map(Number);
    const slotDate = new Date(date);
    slotDate.setHours(hours, minutes, 0, 0);
    return slotDate;
  });
}

async function main() {
  console.log('🌱 Starting database seed...');

  // ============================================
  // 1. CLEANUP (Optional - uncomment for fresh seed)
  // ============================================
  // console.log('🧹 Cleaning up existing data...');
  // await prisma.cita.deleteMany();
  // await prisma.empleadoServicio.deleteMany();
  // await prisma.disponibilidad.deleteMany();
  // await prisma.empleado.deleteMany();
  // await prisma.servicio.deleteMany();
  // await prisma.usuario.deleteMany();
  // console.log('✅ Cleanup complete');

  // ============================================
  // 2. CREATE ADMIN USER
  // ============================================
  console.log('👤 Creating admin user...');
  const adminPassword = await hashPassword('Admin123!');
  
  const adminUser = await prisma.usuario.upsert({
    where: { email: 'admin@sistema.com' },
    update: {},
    create: {
      nombre: 'Administrador',
      email: 'admin@sistema.com',
      passwordHash: adminPassword,
      telefono: '+1234567890',
      rol: Rol.ADMIN,
      activo: true,
    },
  });
  console.log(`✅ Admin user created: ${adminUser.email}`);

  // ============================================
  // 3. CREATE EMPLOYEE USERS
  // ============================================
  console.log('👥 Creating employee users...');
  
  const employeePassword = await hashPassword('Employee123!');
  
  // Employee 1: Juan Pérez
  const juanUser = await prisma.usuario.upsert({
    where: { email: 'juan.perez@sistema.com' },
    update: {},
    create: {
      nombre: 'Juan Pérez',
      email: 'juan.perez@sistema.com',
      passwordHash: employeePassword,
      telefono: '+1234567891',
      rol: Rol.EMPLEADO,
      activo: true,
    },
  });

  // Employee 2: María Gómez
  const mariaUser = await prisma.usuario.upsert({
    where: { email: 'maria.gomez@sistema.com' },
    update: {},
    create: {
      nombre: 'María Gómez',
      email: 'maria.gomez@sistema.com',
      passwordHash: employeePassword,
      telefono: '+1234567892',
      rol: Rol.EMPLEADO,
      activo: true,
    },
  });

  // Create sample client users
  const clientPassword = await hashPassword('Client123!');
  
  const client1 = await prisma.usuario.upsert({
    where: { email: 'cliente1@test.com' },
    update: {},
    create: {
      nombre: 'Carlos Rodríguez',
      email: 'cliente1@test.com',
      passwordHash: clientPassword,
      telefono: '+1234567893',
      rol: Rol.CLIENTE,
      activo: true,
    },
  });

  const client2 = await prisma.usuario.upsert({
    where: { email: 'cliente2@test.com' },
    update: {},
    create: {
      nombre: 'Ana Martínez',
      email: 'cliente2@test.com',
      passwordHash: clientPassword,
      telefono: '+1234567894',
      rol: Rol.CLIENTE,
      activo: true,
    },
  });

  console.log(`✅ Employee users created: ${juanUser.email}, ${mariaUser.email}`);
  console.log(`✅ Client users created: ${client1.email}, ${client2.email}`);

  // ============================================
  // 4. CREATE EMPLOYEES WITH SCHEDULES
  // ============================================
  console.log('📋 Creating employee profiles...');

  // Default working hours (Monday to Friday, 9:00 - 18:00)
  const defaultSchedule = {
    lunes: { inicio: '09:00', fin: '18:00' },
    martes: { inicio: '09:00', fin: '18:00' },
    miercoles: { inicio: '09:00', fin: '18:00' },
    jueves: { inicio: '09:00', fin: '18:00' },
    viernes: { inicio: '09:00', fin: '18:00' },
    sabado: { inicio: '09:00', fin: '14:00' },
    domingo: null,
  };

  const juanEmployee = await prisma.empleado.upsert({
    where: { usuarioId: juanUser.id },
    update: {},
    create: {
      usuarioId: juanUser.id,
      nombre: 'Juan Pérez',
      email: 'juan.perez@sistema.com',
      telefono: '+1234567891',
      activo: true,
      horarioLaboral: defaultSchedule,
    },
  });

  const mariaEmployee = await prisma.empleado.upsert({
    where: { usuarioId: mariaUser.id },
    update: {},
    create: {
      usuarioId: mariaUser.id,
      nombre: 'María Gómez',
      email: 'maria.gomez@sistema.com',
      telefono: '+1234567892',
      activo: true,
      horarioLaboral: defaultSchedule,
    },
  });

  console.log(`✅ Employee profiles created: ${juanEmployee.nombre}, ${mariaEmployee.nombre}`);

  // ============================================
  // 5. CREATE SERVICES
  // ============================================
  console.log('💈 Creating services...');

  const services = [
    {
      nombre: 'Corte de Cabello',
      descripcion: 'Corte de cabello profesional para hombre o mujer',
      duracion: 30,
      precio: 15.00,
      categoria: 'Peluquería',
    },
    {
      nombre: 'Barba',
      descripcion: 'Perfilado y recorte de barba con toalla caliente',
      duracion: 20,
      precio: 10.00,
      categoria: 'Peluquería',
    },
    {
      nombre: 'Corte + Barba',
      descripcion: 'Servicio combinado de corte de cabello y barba',
      duracion: 50,
      precio: 22.00,
      categoria: 'Peluquería',
    },
    {
      nombre: 'Tinte',
      descripcion: 'Aplicación de tinte profesional con productos de calidad',
      duracion: 60,
      precio: 35.00,
      categoria: 'Color',
    },
    {
      nombre: 'Peinado',
      descripcion: 'Peinado profesional para ocasiones especiales',
      duracion: 45,
      precio: 25.00,
      categoria: 'Estilismo',
    },
    {
      nombre: 'Manicure',
      descripcion: 'Manicure completo con esmaltado',
      duracion: 40,
      precio: 18.00,
      categoria: 'Uñas',
    },
    {
      nombre: 'Pedicure',
      descripcion: 'Pedicure completo con masaje relajante',
      duracion: 50,
      precio: 22.00,
      categoria: 'Uñas',
    },
  ];

  const createdServices: Record<string, any> = {};

  for (const service of services) {
    const created = await prisma.servicio.upsert({
      where: { nombre: service.nombre },
      update: {},
      create: service,
    });
    createdServices[service.nombre] = created;
    console.log(`  ✅ Service: ${created.nombre} - $${created.precio} (${created.duracion} min)`);
  }

  // ============================================
  // 6. ASSIGN SERVICES TO EMPLOYEES
  // ============================================
  console.log('🔗 Assigning services to employees...');

  // Juan Pérez specializes in Corte and Barba
  await prisma.empleadoServicio.createMany({
    data: [
      { empleadoId: juanEmployee.id, servicioId: createdServices['Corte de Cabello'].id },
      { empleadoId: juanEmployee.id, servicioId: createdServices['Barba'].id },
      { empleadoId: juanEmployee.id, servicioId: createdServices['Corte + Barba'].id },
    ],
    skipDuplicates: true,
  });
  console.log(`  ✅ Juan Pérez: Corte, Barba, Corte + Barba`);

  // María Gómez specializes in Tinte and Peinado
  await prisma.empleadoServicio.createMany({
    data: [
      { empleadoId: mariaEmployee.id, servicioId: createdServices['Tinte'].id },
      { empleadoId: mariaEmployee.id, servicioId: createdServices['Peinado'].id },
      { empleadoId: mariaEmployee.id, servicioId: createdServices['Manicure'].id },
      { empleadoId: mariaEmployee.id, servicioId: createdServices['Pedicure'].id },
    ],
    skipDuplicates: true,
  });
  console.log(`  ✅ María Gómez: Tinte, Peinado, Manicure, Pedicure`);

  // ============================================
  // 7. CREATE EMPLOYEE AVAILABILITY
  // ============================================
  console.log('📅 Creating employee availability...');

  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Create availability records for the next 7 days
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    // Juan's availability
    await prisma.disponibilidad.create({
      data: {
        empleadoId: juanEmployee.id,
        fecha: date,
        tipo: TipoDisponibilidad.LABORAL,
        inicio: '09:00',
        fin: i === 5 ? '14:00' : '18:00', // Saturday until 14:00
      },
    });

    // María's availability
    await prisma.disponibilidad.create({
      data: {
        empleadoId: mariaEmployee.id,
        fecha: date,
        tipo: TipoDisponibilidad.LABORAL,
        inicio: '09:00',
        fin: i === 5 ? '14:00' : '18:00', // Saturday until 14:00
      },
    });
  }
  console.log(`  ✅ Availability created for next 7 days`);

  // ============================================
  // 8. CREATE SAMPLE APPOINTMENTS
  // ============================================
  console.log('📆 Creating sample appointments...');

  // Get tomorrow's date for appointments
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Appointment 1: Carlos Rodríguez with Juan Pérez - Corte de Cabello
  const appt1Start = new Date(tomorrow);
  appt1Start.setHours(10, 0, 0, 0);
  const appt1End = new Date(appt1Start);
  appt1End.setMinutes(appt1End.getMinutes() + 30);

  const appointment1 = await prisma.cita.create({
    data: {
      clienteId: client1.id,
      empleadoId: juanEmployee.id,
      servicioId: createdServices['Corte de Cabello'].id,
      fechaInicio: appt1Start,
      fechaFin: appt1End,
      estado: EstadoCita.CONFIRMADA,
      notas: 'Primera cita - Cliente nuevo',
    },
  });
  console.log(`  ✅ Appointment: ${client1.nombre} con ${juanEmployee.nombre} - Corte de Cabello (${appt1Start.toLocaleString()})`);

  // Appointment 2: Ana Martínez with María Gómez - Tinte
  const appt2Start = new Date(tomorrow);
  appt2Start.setHours(11, 0, 0, 0);
  const appt2End = new Date(appt2Start);
  appt2End.setMinutes(appt2End.getMinutes() + 60);

  const appointment2 = await prisma.cita.create({
    data: {
      clienteId: client2.id,
      empleadoId: mariaEmployee.id,
      servicioId: createdServices['Tinte'].id,
      fechaInicio: appt2Start,
      fechaFin: appt2End,
      estado: EstadoCita.CONFIRMADA,
      notas: 'Tinte completo - Color castaño',
    },
  });
  console.log(`  ✅ Appointment: ${client2.nombre} con ${mariaEmployee.nombre} - Tinte (${appt2Start.toLocaleString()})`);

  // Appointment 3: Carlos Rodríguez with Juan Pérez - Barba (next week)
  const appt3Start = new Date(nextWeek);
  appt3Start.setHours(15, 0, 0, 0);
  const appt3End = new Date(appt3Start);
  appt3End.setMinutes(appt3End.getMinutes() + 20);

  const appointment3 = await prisma.cita.create({
    data: {
      clienteId: client1.id,
      empleadoId: juanEmployee.id,
      servicioId: createdServices['Barba'].id,
      fechaInicio: appt3Start,
      fechaFin: appt3End,
      estado: EstadoCita.CONFIRMADA,
      notas: 'Perfilado de barba',
    },
  });
  console.log(`  ✅ Appointment: ${client1.nombre} con ${juanEmployee.nombre} - Barba (${appt3Start.toLocaleString()})`);

  // ============================================
  // 9. CREATE BUSINESS CONFIGURATION
  // ============================================
  console.log('⚙️  Creating business configuration...');

  await prisma.configuracion.upsert({
    where: { clave: 'politica_cancelacion' },
    update: {},
    create: {
      clave: 'politica_cancelacion',
      descripcion: 'Política de cancelación del negocio',
      valor: {
        horasMinimas: 24,
        penalidadPorcentaje: 50,
        penalidadTotalHoras: 2,
      },
    },
  });

  await prisma.configuracion.upsert({
    where: { clave: 'configuracion_general' },
    update: {},
    create: {
      clave: 'configuracion_general',
      descripcion: 'Configuración general del negocio',
      valor: {
        nombreNegocio: 'Belleza Total',
        anticipacionMinima: 2,
        duracionSlots: 15,
        moneda: 'USD',
      },
    },
  });

  console.log('  ✅ Business configuration created');

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n🎉 Seed completed successfully!\n');
  console.log('📊 Summary:');
  console.log('  - Users: 4 (1 Admin, 2 Employees, 2 Clients)');
  console.log('  - Services: 7');
  console.log('  - Employees: 2');
  console.log('  - Appointments: 3');
  console.log('  - Configurations: 2');
  console.log('\n🔐 Test Credentials:');
  console.log('  Admin:    admin@sistema.com / Admin123!');
  console.log('  Employee: juan.perez@sistema.com / Employee123!');
  console.log('  Employee: maria.gomez@sistema.com / Employee123!');
  console.log('  Client:   cliente1@test.com / Client123!');
  console.log('  Client:   cliente2@test.com / Client123!');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
