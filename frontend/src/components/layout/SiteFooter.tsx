'use client';

import Link from 'next/link';

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[#0f172a] text-white mt-12" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="text-lg font-semibold">Contacto</div>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li><a className="hover:text-white" href="mailto:info@industriasp.com">info@industriasp.com</a></li>
            <li><a className="hover:text-white" href="tel:+51916695927">+51 916 695 927</a></li>
          </ul>
        </div>
        <div>
          <div className="text-lg font-semibold">Redes</div>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li><a className="hover:text-white" href="#" aria-label="Facebook">Facebook</a></li>
            <li><a className="hover:text-white" href="#" aria-label="Instagram">Instagram</a></li>
            <li><a className="hover:text-white" href="#" aria-label="LinkedIn">LinkedIn</a></li>
          </ul>
        </div>
        <div>
          <div className="text-lg font-semibold">Legal</div>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li><Link className="hover:text-white" href="/legal/terminos">Términos y condiciones</Link></li>
            <li><Link className="hover:text-white" href="/legal/privacidad">Política de privacidad</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-lg font-semibold">Industrias SP</div>
          <p className="mt-3 text-sm text-white/80">Soluciones industriales confiables y eficientes para tu operación.</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-4 text-center text-xs text-white/70">© {year} Industrias SP. Todos los derechos reservados.</div>
      </div>
    </footer>
  );
}

