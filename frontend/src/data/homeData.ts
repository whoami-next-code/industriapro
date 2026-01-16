import { HeroSlide, Product, Service, Testimonial, FAQ } from '@/types';

export const heroSlides: HeroSlide[] = [
  {
    id: '1',
    title: 'Soluciones Industriales de Excelencia',
    subtitle: 'Más de 25 años de experiencia',
    description: 'Ofrecemos productos y servicios industriales de alta calidad con tecnología de vanguardia para optimizar sus procesos productivos.',
    image: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Modern+industrial+facility+with+advanced+machinery+and+professional+lighting%2C+blue+and+gray+color+scheme%2C+high+quality+professional+photography&image_size=landscape_16_9',
    ctaText: 'Descubre Nuestros Productos',
    ctaLink: '/productos',
  },
  {
    id: '2',
    title: 'Innovación y Tecnología',
    subtitle: 'Equipos de última generación',
    description: 'Implementamos las tecnologías más avanzadas para garantizar la máxima eficiencia en sus operaciones industriales.',
    image: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=High-tech+industrial+equipment+with+LED+displays+and+modern+interface%2C+clean+professional+design%2C+blue+accents&image_size=landscape_16_9',
    ctaText: 'Conoce Nuestras Soluciones',
    ctaLink: '/servicios',
  },
  {
    id: '3',
    title: 'Servicio Técnico Especializado',
    subtitle: 'Soporte 24/7 disponible',
    description: 'Nuestro equipo de expertos técnicos está disponible para brindarle el mejor servicio y soporte continuo.',
    image: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Professional+technical+team+working+on+industrial+equipment%2C+modern+workshop+environment%2C+professional+lighting&image_size=landscape_16_9',
    ctaText: 'Contacta a Nuestros Expertos',
    ctaLink: '/contacto',
  },
];

export const featuredProducts: Product[] = [
  {
    id: '1',
    name: 'Compresor Industrial Atlas',
    description: 'Compresor de alta eficiencia con tecnología de ahorro energético',
    price: 15499.99,
    originalPrice: 18999.99,
    image: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Industrial+air+compressor+with+modern+design%2C+blue+and+gray+colors%2C+professional+industrial+photography&image_size=square',
    category: 'Compresores',
    rating: 4.8,
    reviews: 124,
    inStock: true,
    slug: 'compresor-industrial-atlas',
  },
  {
    id: '2',
    name: 'Generador Eléctrico 50kW',
    description: 'Generador diesel con sistema automático de arranque',
    price: 28999.99,
    image: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Industrial+diesel+generator+with+modern+design%2C+professional+lighting%2C+blue+and+gray+colors&image_size=square',
    category: 'Generadores',
    rating: 4.9,
    reviews: 89,
    inStock: true,
    slug: 'generador-electrico-50kw',
  },
  {
    id: '3',
    name: 'Bomba Centrífuga 5HP',
    description: 'Bomba de alta presión para aplicaciones industriales',
    price: 8499.99,
    originalPrice: 9999.99,
    image: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Industrial+centrifugal+pump+with+modern+design%2C+professional+lighting%2C+blue+accents&image_size=square',
    category: 'Bombas',
    rating: 4.7,
    reviews: 156,
    inStock: true,
    slug: 'bomba-centrifuga-5hp',
  },
  {
    id: '4',
    name: 'Motor Eléctrico 10HP',
    description: 'Motor trifásico con protección térmica integrada',
    price: 12999.99,
    image: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Industrial+electric+motor+with+modern+design%2C+professional+lighting%2C+blue+and+gray+colors&image_size=square',
    category: 'Motores',
    rating: 4.6,
    reviews: 203,
    inStock: true,
    slug: 'motor-electrico-10hp',
  },
];

export const services: Service[] = [
  {
    id: '1',
    title: 'Mantenimiento Industrial',
    description: 'Servicios de mantenimiento preventivo y correctivo para equipos industriales',
    icon: 'Settings',
    features: [
      'Mantenimiento preventivo programado',
      'Diagnóstico avanzado de fallas',
      'Reparación de equipos',
      'Sustitución de piezas',
    ],
    slug: 'mantenimiento-industrial',
  },
  {
    id: '2',
    title: 'Instalación de Equipos',
    description: 'Instalación profesional y configuración de equipos industriales',
    icon: 'Wrench',
    features: [
      'Instalación certificada',
      'Configuración de parámetros',
      'Pruebas de funcionamiento',
      'Capacitación de operadores',
    ],
    slug: 'instalacion-equipos',
  },
  {
    id: '3',
    title: 'Consultoría Técnica',
    description: 'Asesoramiento especializado en optimización de procesos industriales',
    icon: 'Lightbulb',
    features: [
      'Análisis de procesos',
      'Recomendaciones técnicas',
      'Optimización de eficiencia',
      'Reducción de costos',
    ],
    slug: 'consultoria-tecnica',
  },
  {
    id: '4',
    title: 'Soporte 24/7',
    description: 'Servicio de soporte técnico disponible las 24 horas del día',
    icon: 'Headset',
    features: [
      'Atención telefónica inmediata',
      'Servicio de emergencia',
      'Diagnóstico remoto',
      'Despacho de técnicos',
    ],
    slug: 'soporte-24-7',
  },
];

export const testimonials: Testimonial[] = [
  {
    id: '1',
    name: 'Carlos Rodríguez',
    role: 'Gerente de Producción',
    company: 'Industrias Metalúrgicas S.A.',
    content: 'Excelente servicio y productos de alta calidad. La implementación de los equipos mejoró significativamente nuestra eficiencia productiva.',
    rating: 5,
    image: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Professional+male+manager+portrait%2C+business+attire%2C+confident+expression%2C+professional+lighting&image_size=square',
  },
  {
    id: '2',
    name: 'María González',
    role: 'Directora de Operaciones',
    company: 'Química Industrial Ltda.',
    content: 'El equipo técnico es altamente profesional y el soporte post-venta es excepcional. Recomendados ampliamente.',
    rating: 5,
    image: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Professional+female+executive+portrait%2C+business+attire%2C+confident+expression%2C+professional+lighting&image_size=square',
  },
  {
    id: '3',
    name: 'Roberto Méndez',
    role: 'Supervisor de Mantenimiento',
    company: 'Textiles del Valle S.A.',
    content: 'Los equipos son robustos y confiables. El servicio de mantenimiento preventivo nos ha ayudado a evitar paros no programados.',
    rating: 4,
    image: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=Professional+male+supervisor+portrait%2C+work+attire%2C+professional+lighting&image_size=square',
  },
];

export const faqs: FAQ[] = [
  {
    id: '1',
    question: '¿Cuál es el tiempo de entrega de los productos?',
    answer: 'El tiempo de entrega estándar es de 5-7 días hábiles para productos en stock. Para productos especiales o personalizados, el plazo puede variar entre 15-30 días hábiles.',
    category: 'Envíos',
  },
  {
    id: '2',
    question: '¿Ofrecen garantía en sus productos?',
    answer: 'Sí, todos nuestros productos cuentan con garantía del fabricante de mínimo 12 meses. Algunos equipos pueden tener garantías extendidas de hasta 24 meses.',
    category: 'Garantía',
  },
  {
    id: '3',
    question: '¿Realizan instalación de los equipos?',
    answer: 'Contamos con un equipo técnico especializado en la instalación y configuración de todos nuestros equipos. El servicio incluye capacitación del personal operativo.',
    category: 'Servicios',
  },
  {
    id: '4',
    question: '¿Tienen servicio de mantenimiento?',
    answer: 'Ofrecemos planes de mantenimiento preventivo y correctivo adaptados a las necesidades de cada cliente, con disponibilidad 24/7 para emergencias.',
    category: 'Mantenimiento',
  },
  {
    id: '5',
    question: '¿Cómo puedo solicitar una cotización?',
    answer: 'Puede solicitar su cotización a través de nuestro formulario web, por teléfono al +51 916 695 927, o visitando nuestras oficinas. Respondemos en menos de 24 horas.',
    category: 'Cotizaciones',
  },
];

export const stats = [
  { id: '1', label: 'Años de Experiencia', value: 25, suffix: '+' },
  { id: '2', label: 'Clientes Satisfechos', value: 1200, suffix: '+' },
  { id: '3', label: 'Proyectos Completados', value: 850, suffix: '+' },
  { id: '4', label: 'Equipos Vendidos', value: 3200, suffix: '+' },
];