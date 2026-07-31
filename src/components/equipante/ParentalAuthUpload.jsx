import React, { useState, useRef } from 'react';
import { UploadCloud, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

const ParentalAuthUpload = ({ equipanteId, onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateFile = (selectedFile) => {
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      toast({ title: 'Erro', description: 'Apenas PNG, JPG e PDF são permitidos.', variant: 'destructive' });
      return false;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({ title: 'Erro', description: 'O tamanho máximo do arquivo é 10MB.', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) setFile(droppedFile);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      await onUploadSuccess(file);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="bg-black/40 border-white/10">
      <CardContent className="p-6">
        <h3 className="text-lg font-medium text-white mb-4">Envio da Autorização</h3>
        {!file ? (
          <div
            className={`dropzone rounded-xl p-8 text-center cursor-pointer ${dragActive ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,application/pdf"
              onChange={handleChange}
            />
            <UploadCloud className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-300 font-medium mb-1">Clique ou arraste o arquivo aqui</p>
            <p className="text-gray-500 text-sm">PNG, JPG ou PDF (Máx. 10MB)</p>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <File className="h-8 w-8 text-blue-400" />
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-white truncate max-w-[200px] sm:max-w-[300px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFile(null)}
                className="text-gray-400 hover:text-red-400"
                disabled={isUploading}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isUploading ? 'Enviando...' : 'Confirmar Envio'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ParentalAuthUpload;