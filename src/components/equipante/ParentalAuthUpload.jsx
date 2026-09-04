import React, { useState, useRef } from 'react';
import { UploadCloud, File, X, CheckCircle, AlertCircle, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/services/supabaseClient';

const ParentalAuthUpload = ({ equipanteId, onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  // Modelo (template) da autorizacao dos pais, para download antes do envio.
  // O arquivo precisa ser enviado manualmente (bucket PUBLICO) no Supabase
  // Storage -- ver nomes do bucket/arquivo abaixo. Montamos a URL via
  // supabase.storage.from(...).getPublicUrl(...) (cliente ja configurado
  // com VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY), nunca com um project ID
  // fixo no codigo -- mesmo padrao corrigido em TermosResponsabilidade.jsx.
  const MODELO_BUCKET_NAME = "autorizacao-menor-idade-equipante";
  const MODELO_FILE_NAME = "autorizacao_dos_pais_menor_idade_metanoia_radical_serra_equipante.pdf";
  const { data: { publicUrl: MODELO_URL } } = supabase.storage.from(MODELO_BUCKET_NAME).getPublicUrl(MODELO_FILE_NAME);

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

        <div className="bg-slate-100/5 p-4 rounded-md border border-white/10 transition-colors hover:bg-slate-100/10 mb-4">
          <a
            href={MODELO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline flex items-center gap-2 break-all text-sm font-medium group"
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">Baixar modelo de autorização dos pais</span>
            <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
          </a>
          <p className="text-gray-400 text-xs mt-2">Baixe o modelo, preencha e assine, depois anexe o arquivo abaixo.</p>
        </div>
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