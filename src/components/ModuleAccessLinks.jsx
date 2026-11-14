import React from 'react';

export function ModuleAccessLinks() {
  return (
    <section aria-labelledby="application-access-title" className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-700">
      <h2 id="application-access-title" className="font-semibold text-stone-950">Accesos a mis aplicaciones</h2>
      <p className="mt-2">Trabajo / Taura: roster, turnos y pagos estimados en la aplicación actual.</p>
      <a
        href="https://taura-roster-pay-676l.vercel.app"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex min-h-[44px] items-center rounded-lg px-3 py-2 font-semibold text-teal-800 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        Abrir Taura en otra pestaña
      </a>
      <p className="mt-2 break-all text-xs">https://taura-roster-pay-676l.vercel.app</p>
      <p className="mt-2">Finance y Taura siguen siendo aplicaciones separadas. Sus datos siguen separados: este enlace no los comparte ni importa.</p>
      <p className="mt-1">Si usás Taura instalada, podés seguir abriéndola desde su icono. Si el enlace no está disponible, podés continuar usando Finance.</p>
    </section>
  );
}
