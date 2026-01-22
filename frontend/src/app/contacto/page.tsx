'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, Phone, Mail, Clock, Send, User, MessageSquare, Building, CheckCircle, AlertCircle } from 'lucide-react';
import { apiFetch, apiFetchAuth, getToken } from '@/lib/api';

interface FormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  service: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
}

interface ClienteProfile {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
}

export default function ContactoPage() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '+51 ',
    company: '',
    service: '',
    message: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error' | 'unauthorized'>('idle');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let isActive = true;
    (async () => {
      try {
        const profile = (await apiFetchAuth('/clientes/me')) as ClienteProfile;
        if (!isActive) return;
        setFormData((prev) => ({
          ...prev,
          name: profile?.fullName ?? prev.name,
          email: profile?.email ?? prev.email,
          phone: profile?.phone ?? prev.phone,
        }));
      } catch {
        // Si falla, dejamos el formulario editable sin bloquear
      }
    })();
    return () => {
      isActive = false;
    };
  }, []);

  const services = [
    'Mantenimiento Industrial',
    'Instalaciones Eléctricas',
    'Seguridad Industrial',
    'Consultoría Técnica',
    'Otro'
  ];

  const offices = [
    {
      id: '1',
      name: 'Oficina Principal - Huancayo',
      address: 'Jirón Nemesio Raez, El Tampo',
      phone: '+51 916 695 927',
      email: 'info@industriasp.com',
      hours: 'Lunes a Viernes: 8:00 - 18:00 hrs',
      coordinates: { lat: -12.0681, lng: -75.2106 }
    },
    {
      id: '2',
      name: 'Sucursal Centro',
      address: 'Calle Mariscal Ramón Castilla 1609',
      phone: '+51 916 695 927',
      email: 'ventas@industriasp.com',
      hours: 'Lunes a Viernes: 8:00 - 18:00 hrs',
      coordinates: { lat: -12.0651, lng: -75.2048 }
    },
    {
      id: '3',
      name: 'Sucursal Norte',
      address: 'Jirón Libertad',
      phone: '+51 916 695 927',
      email: 'soporte@industriasp.com',
      hours: 'Lunes a Viernes: 8:00 - 18:00 hrs',
      coordinates: { lat: -12.0700, lng: -75.2200 }
    }
  ];

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Por favor ingrese un email válido';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'El teléfono es requerido';
    } else if (!/^(?:\+51|51)?\s?9\d{2}[\s-]?\d{3}[\s-]?\d{3}$/.test(formData.phone)) {
      newErrors.phone = 'Por favor ingrese un número de teléfono válido (ej: +51 916 695 927)';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'El mensaje es requerido';
    } else if (formData.message.length < 10) {
      newErrors.message = 'El mensaje debe tener al menos 10 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const nextValue = name === 'phone' && value.trim() === '' ? '+51 ' : value;
    setFormData(prev => ({ ...prev, [name]: nextValue }));
    
    // Clear error for this field when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) {
      setSubmitStatus('unauthorized');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const messageParts = [
        formData.message?.trim(),
        formData.service?.trim() ? `Servicio de interés: ${formData.service}` : '',
        formData.company?.trim() ? `Empresa: ${formData.company}` : '',
      ].filter(Boolean);

      await apiFetchAuth('/contactos', {
        method: 'POST',
        body: JSON.stringify({
          nombre: formData.name.trim(),
          email: formData.email.trim(),
          telefono: formData.phone.trim(),
          mensaje: messageParts.join('\n'),
        }),
      });
      
      setSubmitStatus('success');
      setFormData((prev) => ({
        name: token ? prev.name : '',
        email: token ? prev.email : '',
        phone: token ? prev.phone : '',
        company: '',
        service: '',
        message: '',
      }));
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error submitting form:', error);
      }
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openGoogleMaps = (coordinates: { lat: number; lng: number }) => {
    const url = `https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white py-20">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Contacto
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            Estamos aquí para ayudarte con tus proyectos industriales
          </p>
        </div>
      </section>

      {/* Contact Form and Info */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Envíanos un mensaje</h2>
                <p className="text-lg text-gray-600">
                  Completa el formulario y nos pondremos en contacto contigo dentro de 24 horas hábiles.
                </p>
              </div>

              {submitStatus === 'success' && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <p className="text-green-800">
                    ¡Gracias por tu mensaje! Nos pondremos en contacto contigo pronto.
                  </p>
                </div>
              )}

              {submitStatus === 'unauthorized' && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                  <p className="text-yellow-800">
                    Debes iniciar sesión para enviar el formulario de contacto.
                  </p>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <p className="text-red-800">
                    Hubo un error al enviar tu mensaje. Por favor, inténtalo de nuevo.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre completo *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className={`block w-full pl-10 pr-3 py-3 border ${errors.name ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-blue-500 focus:border-blue-500`}
                        placeholder="Juan Pérez"
                      />
                    </div>
                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email corporativo *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={`block w-full pl-10 pr-3 py-3 border ${errors.email ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-blue-500 focus:border-blue-500`}
                        placeholder="juan.perez@empresa.com"
                      />
                    </div>
                    {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Teléfono *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className={`block w-full pl-10 pr-3 py-3 border ${errors.phone ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-blue-500 focus:border-blue-500`}
                        placeholder="+51 916 695 927"
                      />
                    </div>
                    {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
                  </div>

                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                      Empresa
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="company"
                        name="company"
                        value={formData.company}
                        onChange={handleInputChange}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Nombre de tu empresa"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="service" className="block text-sm font-medium text-gray-700 mb-2">
                    Servicio de interés
                  </label>
                  <select
                    id="service"
                    name="service"
                    value={formData.service}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Selecciona un servicio</option>
                    {services.map((service) => (
                      <option key={service} value={service}>
                        {service}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    Mensaje *
                  </label>
                  <div className="relative">
                    <div className="absolute top-3 left-3 flex items-center pointer-events-none">
                      <MessageSquare className="h-5 w-5 text-gray-400" />
                    </div>
                    <textarea
                      id="message"
                      name="message"
                      rows={4}
                      value={formData.message}
                      onChange={handleInputChange}
                      className={`block w-full pl-10 pr-3 py-3 border ${errors.message ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-blue-500 focus:border-blue-500`}
                      placeholder="Cuéntanos sobre tu proyecto o consulta..."
                    />
                  </div>
                  {errors.message && <p className="mt-1 text-sm text-red-600">{errors.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-2" />
                      Enviar Mensaje
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Contact Information */}
            <div>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Información de Contacto</h2>
                <p className="text-lg text-gray-600">
                  Contamos con oficinas en las principales ciudades del país para servirte mejor.
                </p>
              </div>

              <div className="space-y-6">
                {offices.map((office) => (
                  <div key={office.id} className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">{office.name}</h3>
                    
                    <div className="space-y-3">
                      <div className="flex items-start">
                        <MapPin className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                        <p className="text-gray-600 text-sm">{office.address}</p>
                      </div>
                      
                      <div className="flex items-center">
                        <Phone className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0" />
                        <a href={`tel:${office.phone.replace(/\s/g, '')}`} className="text-gray-600 text-sm hover:text-blue-600">
                          {office.phone}
                        </a>
                      </div>
                      
                      <div className="flex items-center">
                        <Mail className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0" />
                        <a href={`mailto:${office.email}`} className="text-gray-600 text-sm hover:text-blue-600">
                          {office.email}
                        </a>
                      </div>
                      
                      <div className="flex items-center">
                        <Clock className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0" />
                        <p className="text-gray-600 text-sm">{office.hours}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => openGoogleMaps(office.coordinates)}
                      className="mt-4 w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Ver en Google Maps
                    </button>
                  </div>
                ))}
              </div>

              {/* Emergency Contact */}
              <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-red-900 mb-3">Contacto de Emergencia</h3>
                <p className="text-red-800 text-sm mb-3">
                  Para emergencias industriales o soporte técnico urgente, contáctanos las 24 horas:
                </p>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 text-red-600 mr-2" />
                    <a href="tel:+51916695927" className="text-red-800 font-medium">
                      +51 916 695 927
                    </a>
                  </div>
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 text-red-600 mr-2" />
                    <a href="mailto:emergencias@industriasp.com" className="text-red-800 font-medium">
                      emergencias@industriasp.com
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Encuéntranos</h2>
            <p className="text-lg text-gray-600">
              Visita nuestras oficinas en las principales ciudades del país
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="aspect-w-16 aspect-h-9">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3762.8095639131084!2d-99.1332!3d19.4326!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTnCsDI1JzU3LjQiTiA5OcKwMDcnNTkuNSJX!5e0!3m2!1ses!2smx!4v1234567890"
                width="100%"
                height="450"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ubicación de Industrias SP"
              />
            </div>
            <div className="p-6 bg-white">
              <div className="flex flex-wrap justify-center gap-4">
                {offices.map((office) => (
                  <button
                    key={office.id}
                    onClick={() => openGoogleMaps(office.coordinates)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    {office.name.split(' - ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Preguntas Frecuentes</h2>
            <p className="text-lg text-gray-600">
              Respuestas a las preguntas más comunes sobre nuestros servicios
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                ¿Cuál es el tiempo de respuesta para una cotización?
              </h3>
              <p className="text-gray-600">
                Normalmente respondemos con una cotización detallada dentro de 24 a 48 horas hábiles después de recibir toda la información necesaria sobre tu proyecto.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                ¿En qué zonas geográficas trabajan?
              </h3>
              <p className="text-gray-600">
                Actualmente operamos principalmente en Huancayo y la región central del Perú. También realizamos proyectos en otras zonas según los requerimientos del cliente.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                ¿Ofrecen servicios de emergencia 24/7?
              </h3>
              <p className="text-gray-600">
                Sí, contamos con un equipo de emergencia disponible las 24 horas del día, los 7 días de la semana para atender situaciones críticas en instalaciones industriales.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                ¿Cuáles son sus certificaciones y estándares de calidad?
              </h3>
              <p className="text-gray-600">
                Contamos con certificaciones ISO 9001:2015, OSHA 30-Hour, certificaciones NEC y Green Industry. Todos nuestros técnicos están certificados y actualizados constantemente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            ¿Listo para iniciar tu proyecto?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Solicita una cotización gratuita y sin compromiso para tu proyecto industrial
          </p>
          <a
            href="/servicios"
            className="inline-flex items-center px-8 py-3 bg-white text-blue-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            Ver Servicios
          </a>
        </div>
      </section>
    </div>
  );
}