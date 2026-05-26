import React from 'react';

export function AppTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="border-b border-stone-200">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-2">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              label={tab.label}
              onClick={() => onChange(tab.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, label, onClick }) {
  return (
    <button
      className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
        active
          ? 'border-teal-600 text-stone-950'
          : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800'
      }`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
