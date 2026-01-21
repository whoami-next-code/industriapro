'use client';

import { useState, FormEvent } from 'react';

export default function ContactSection() {
  const whatsappNumber = '51931005970';
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const message = [
        `Nombre: ${formData.name}`,
        `Email: ${formData.email}`,
        formData.phone ? `Teléfono: ${formData.phone}` : null,
        `Asunto: ${formData.subject}`,
        `Mensaje: ${formData.message}`,
      ]
        .filter(Boolean)
        .join('\n');

      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

      setSubmitStatus('success');
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (error) {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contacto" className="py-12 bg-gray-50" aria-labelledby="contacto-heading">
      <div className="mx-auto max-w-7xl px-4">
        <h2 id="contacto-heading" className="text-2xl font-bold text-gray-900 mb-6">Contacto</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <form 
            onSubmit={handleSubmit}
            className="rounded-xl border bg-white p-6 space-y-3"
            aria-label="Formulario de contacto"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="contact-name" className="sr-only">Nombre</label>
                <input 
                  id="contact-name"
                  type="text"
                  placeholder="Nombre" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  aria-required="true"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="sr-only">Email</label>
                <input 
                  id="contact-email"
                  type="email" 
                  placeholder="Email" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  aria-required="true"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="contact-phone" className="sr-only">Teléfono</label>
                <input 
                  id="contact-phone"
                  type="tel"
                  placeholder="Teléfono" 
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label htmlFor="contact-subject" className="sr-only">Asunto</label>
                <input 
                  id="contact-subject"
                  type="text"
                  placeholder="Asunto" 
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  aria-required="true"
                />
              </div>
            </div>
            <div>
              <label htmlFor="contact-message" className="sr-only">Mensaje</label>
              <textarea 
                id="contact-message"
                placeholder="Mensaje" 
                required
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 h-28 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                aria-required="true"
              />
            </div>
            {submitStatus === 'success' && (
              <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm" role="alert">
                Mensaje enviado correctamente. Nos pondremos en contacto contigo pronto.
              </div>
            )}
            {submitStatus === 'error' && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm" role="alert">
                Error al enviar el mensaje. Por favor, intenta nuevamente.
              </div>
            )}
            <button 
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {isSubmitting ? 'Enviando...' : 'Enviar'}
            </button>
          </form>
          <div className="space-y-4">
            <div className="rounded-xl overflow-hidden border">
              <iframe 
                title="Mapa de ubicación de Industrias SP en Huancayo, Perú" 
                src="https://maps.google.com/maps?width=100%25&height=300&hl=es&q=Jiron%20Nemesio%20Raez%2C%20El%20Tampo%2C%20Huancayo%2C%20Peru&ie=UTF8&t=&z=14&iwloc=B&output=embed" 
                className="w-full h-64"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                aria-label="Mapa interactivo mostrando la ubicación de Industrias SP"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-white p-4">
                <div className="font-semibold">+51 916 695 927</div>
                <div className="text-sm text-gray-600 mt-2">Lun–Vie 8:00–18:00</div>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <div className="font-semibold">info@industriasp.com</div>
                <div className="text-sm text-gray-600 mt-2">Jirón Nemesio Raez, El Tampo</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

