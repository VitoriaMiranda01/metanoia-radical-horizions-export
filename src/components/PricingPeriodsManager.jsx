import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const formatDateInput = (val) => {
  let v = val.replace(/\D/g, '').slice(0, 8);
  if (v.length >= 5) return `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
  if (v.length >= 3) return `${v.slice(0, 2)}/${v.slice(2)}`;
  return v;
};

const formatCurrencyInput = (val) => {
  let v = val.replace(/\D/g, '');
  if (v === '') return '';
  v = (parseInt(v, 10) / 100).toFixed(2);
  return v;
};

const parseDate = (str) => {
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  return new Date(y, m - 1, d);
};

const PricingPeriodsManager = ({ type, periods = [], onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    value: ''
  });

  const handleAddNew = () => {
    setError('');
    setEditingId(null);
    setFormData({ start_date: '', end_date: '', value: '' });
    setIsEditing(true);
  };

  const handleEdit = (period) => {
    setError('');
    setEditingId(period.id);
    setFormData({
      start_date: period.start_date,
      end_date: period.end_date,
      value: period.value
    });
    setIsEditing(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Tem certeza que deseja remover este período?')) {
      onChange(periods.filter(p => p.id !== id));
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    setError('');
  };

  const handleSave = () => {
    setError('');

    // Validation 1: All fields required
    if (!formData.start_date || !formData.end_date || !formData.value || formData.start_date.length !== 10 || formData.end_date.length !== 10) {
      setError('Todos os campos são obrigatórios');
      return;
    }

    const startDateObj = parseDate(formData.start_date);
    const endDateObj = parseDate(formData.end_date);

    if (!startDateObj || !endDateObj || isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      setError('Formato de data inválido');
      return;
    }

    const startMs = startDateObj.getTime();
    const endMs = endDateObj.getTime();

    // Validation 2: End before Start
    if (endMs < startMs) {
      setError('Data final não pode ser anterior à data inicial');
      return;
    }

    // Validation 3: Overlap
    const hasOverlap = periods.some(p => {
      if (p.id === editingId) return false;
      const pStart = parseDate(p.start_date).getTime();
      const pEnd = parseDate(p.end_date).getTime();
      return startMs <= pEnd && pStart <= endMs;
    });

    if (hasOverlap) {
      setError('Período sobrepõe com outro período existente');
      return;
    }

    const newPeriod = {
      id: editingId || Date.now().toString(),
      start_date: formData.start_date,
      end_date: formData.end_date,
      value: parseFloat(formData.value).toFixed(2)
    };

    let updatedPeriods;
    if (editingId) {
      updatedPeriods = periods.map(p => p.id === editingId ? newPeriod : p);
    } else {
      updatedPeriods = [...periods, newPeriod];
    }

    // Sort by start date
    updatedPeriods.sort((a, b) => parseDate(a.start_date).getTime() - parseDate(b.start_date).getTime());

    onChange(updatedPeriods);
    setIsEditing(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {periods.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-white/10">
          <table className="w-full text-sm text-left text-white">
            <thead className="text-xs uppercase bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-medium">Data Inicial</th>
                <th className="px-4 py-3 font-medium">Data Final</th>
                <th className="px-4 py-3 font-medium">Valor (R$)</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {periods.map(period => (
                  <motion.tr 
                    key={period.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="px-4 py-3">{period.start_date}</td>
                    <td className="px-4 py-3">{period.end_date}</td>
                    <td className="px-4 py-3">R$ {parseFloat(period.value).toFixed(2).replace('.', ',')}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEdit(period)}
                          className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                          disabled={isEditing}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDelete(period.id)}
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                          disabled={isEditing}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      {periods.length === 0 && !isEditing && (
        <div className="text-center p-6 border border-dashed border-white/20 rounded-md text-gray-400">
          Nenhum período cadastrado.
        </div>
      )}

      <AnimatePresence>
        {isEditing && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-black/40 border border-white/20 p-4 rounded-md space-y-4"
          >
            <h4 className="text-white font-medium mb-2">
              {editingId ? 'Editar Período' : 'Novo Período'}
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Data Inicial</Label>
                <Input 
                  placeholder="DD/MM/AAAA"
                  value={formData.start_date}
                  onChange={e => setFormData({ ...formData, start_date: formatDateInput(e.target.value) })}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Data Final</Label>
                <Input 
                  placeholder="DD/MM/AAAA"
                  value={formData.end_date}
                  onChange={e => setFormData({ ...formData, end_date: formatDateInput(e.target.value) })}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Valor (R$)</Label>
                <Input 
                  placeholder="0,00"
                  value={formData.value}
                  onChange={e => setFormData({ ...formData, value: formatCurrencyInput(e.target.value) })}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm font-medium">{error}</p>
            )}

            <div className="flex space-x-3 pt-2">
              <Button 
                onClick={handleSave}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Check className="w-4 h-4 mr-2" />
                Salvar
              </Button>
              <Button 
                variant="outline" 
                onClick={handleCancel}
                className="border-white/20 text-gray-300 hover:bg-white/10 hover:text-white"
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isEditing && (
        <Button 
          variant="outline" 
          onClick={handleAddNew}
          className="w-full border-dashed border-white/20 text-black hover:bg-white/5 hover:text-white hover:border-white/40"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Período
        </Button>
      )}
    </div>
  );
};

export default PricingPeriodsManager;