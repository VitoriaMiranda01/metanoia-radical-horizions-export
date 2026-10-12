import React, { useState } from 'react';
import { FlaskConical, LogOut } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { emTeste, irParaTeste, sairDoTeste } from '@/services/ambiente';

/**
 * Atalho para o ambiente de TESTE (Patrick, 12/10/2026) -- o mesmo do link
 * ?ambiente=teste (services/ambiente.js). Dentro do teste, o quadro vira
 * "Voltar para o oficial".
 */
const AmbienteTesteCard = () => {
  const [confirmar, setConfirmar] = useState(false);
  const noTeste = emTeste();

  return (
    <Card className="glass-effect border-orange-500/30 bg-black/40">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <FlaskConical className="w-5 h-5 text-orange-400" />
          <span>Ambiente de teste</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          {noTeste
            ? 'Você está no ambiente de teste. Nada aqui vale de verdade.'
            : 'Uma cópia do sistema com banco separado, para testar sem mexer nos dados reais. O PIX lá é simulado.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {noTeste ? (
          <Button
            onClick={sairDoTeste}
            data-dica="Sair do teste e voltar para o sistema oficial. Será preciso entrar de novo."
            className="bg-black/80 hover:bg-black text-orange-200 border border-orange-500/40"
          >
            <LogOut className="w-4 h-4 mr-2" /> Voltar para o oficial
          </Button>
        ) : (
          <Button
            onClick={() => setConfirmar(true)}
            data-dica="Abrir o ambiente de teste. Você sai da conta e entra de novo, já no teste."
            className="bg-orange-500 hover:bg-orange-600 text-black font-semibold"
          >
            <FlaskConical className="w-4 h-4 mr-2" /> Ir para o ambiente de teste
          </Button>
        )}
      </CardContent>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent className="bg-zinc-900 border border-orange-500/40 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-300">
              <FlaskConical className="w-5 h-5" /> Ir para o ambiente de teste?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300 space-y-2">
              <span className="block">Você sai da sua conta aqui e entra de novo, já no teste, com o seu usuário e senha do teste.</span>
              <span className="block">Uma faixa laranja fica no pé da tela enquanto estiver no teste. Para voltar, use "Sair do teste" na faixa.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={irParaTeste} className="bg-orange-500 hover:bg-orange-600 text-black font-semibold border-none">
              Ir para o teste
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default AmbienteTesteCard;
