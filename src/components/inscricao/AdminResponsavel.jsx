import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FormSection from './FormSection';
import { IGREJAS_PARCEIRAS } from '@/constants/igrejas';

const AdminResponsavel = ({ formData, handleChange, handleSelectChange }) => {
  return (
    <FormSection title="Igreja Responsável">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label htmlFor="adminResponsavel" className="text-white">Igreja Responsável pela Inscrição</Label>
          <Select
            value={formData.adminResponsavel}
            onValueChange={(value) => handleSelectChange('adminResponsavel', value)}
          >
            <SelectTrigger className="bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Selecione a igreja..." />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {IGREJAS_PARCEIRAS.map((option, index) => (
                <SelectItem key={index} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </FormSection>
  );
};

export default AdminResponsavel;