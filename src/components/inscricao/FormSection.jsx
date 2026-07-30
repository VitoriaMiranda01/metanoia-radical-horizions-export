import React from 'react';

const FormSection = ({ title, children }) => (
  <div className="space-y-4">
    <h3 className="text-lg font-semibold text-white border-b border-white/20 pb-2">
      {title}
    </h3>
    {children}
  </div>
);

export default FormSection;