'use client';

import Link from 'next/link';
import { Phone, Mail, MapPin, Clock, Facebook, Twitter, Linkedin, Instagram } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="lg:col-span-1">
            <Link href="/" className="inline-block mb-6">
              <div className="text-2xl font-bold">
                <span className="text-orange-500">Industria</span>SP
              </div>
            </Link>
            <p className="text-gray-300 mb-6 leading-relaxed">
              Soluciones industriales integrales con más de 15 años de experiencia. 
              Especialistas en equipamiento y servicios para la industria peruana.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-orange-500 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-orange-500 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-orange-500 transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-orange-500 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-6 text-orange-500">Enlaces rápidos</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/catalogo" className="text-gray-300 hover:text-orange-500 transition-colors">
                  Catálogo de productos
                </Link>
              </li>
              <li>
                <Link href="/cotizacion" className="text-gray-300 hover:text-orange-500 transition-colors">
                  Solicitar cotización
                </Link>
              </li>
              <li>
                <Link href="/mis-cotizaciones" className="text-gray-300 hover:text-orange-500 transition-colors">
                  Mis cotizaciones
                </Link>
              </li>
              <li>
                <Link href="/servicios" className="text-gray-300 hover:text-orange-500 transition-colors">
                  Servicios
                </Link>
              </li>
              <li>
                <Link href="/nosotros" className="text-gray-300 hover:text-orange-500 transition-colors">
                  Sobre nosotros
                </Link>
              </li>
              <li>
                <Link href="/contacto" className="text-gray-300 hover:text-orange-500 transition-colors">
                  Contacto
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-semibold mb-6 text-orange-500">Servicios</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/mantenimiento" className="text-gray-300 hover:text-orange-500 transition-colors">
                  Mantenimiento Industrial
                </Link>
              </li>
              <li>
                <Link href="/instalacion" className="text-gray-300 hover:text-orange-500 transition-colors">
                  Instalación de equipos
                </Link>
              </li>
              <li>
                <Link href="/soporte" className="text-gray-300 hover:text-orange-500 transition-colors">
                  Soporte técnico
                </Link>
              </li>
              <li>
                <Link href="/capacitacion" className="text-gray-300 hover:text-orange-500 transition-colors">
                  Capacitación
                </Link>
              </li>
              <li>
                <Link href="/repuestos" className="text-gray-300 hover:text-orange-500 transition-colors">
                  Repuestos y accesorios
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-6 text-orange-500">Contacto</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-orange-500 mt-1 flex-shrink-0" />
                <div className="text-gray-300">
                  <p className="font-medium">Dirección:</p>
                  <p>Jirón Nemesio Raez, El Tampo</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Phone className="w-5 h-5 text-orange-500 mt-1 flex-shrink-0" />
                <div className="text-gray-300">
                  <p className="font-medium">Teléfono:</p>
                  <p>+51 916 695 927</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Mail className="w-5 h-5 text-orange-500 mt-1 flex-shrink-0" />
                <div className="text-gray-300">
                  <p className="font-medium">Email:</p>
                  <p>info@industriasp.com</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Clock className="w-5 h-5 text-orange-500 mt-1 flex-shrink-0" />
                <div className="text-gray-300">
                  <p className="font-medium">Horario:</p>
                  <p>Lun - Vie: 8:00 - 18:00</p>
                  <p>Sáb: 8:00 - 13:00</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Newsletter */}
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-xl font-semibold mb-2">Suscríbete a nuestro boletín</h3>
              <p className="text-gray-300">
                Recibe las últimas novedades, ofertas y actualizaciones de nuestros productos.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                placeholder="Tu correo electrónico"
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors"
              />
              <button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                Suscribirse
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bg-gray-800 py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-gray-400 text-sm">
              © 2024 Industrias SP. Todos los derechos reservados.
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-400">
              <Link href="/terminos" className="hover:text-orange-500 transition-colors">
                Términos y condiciones
              </Link>
              <Link href="/privacidad" className="hover:text-orange-500 transition-colors">
                Política de privacidad
              </Link>
              <Link href="/garantia" className="hover:text-orange-500 transition-colors">
                Garantía
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}