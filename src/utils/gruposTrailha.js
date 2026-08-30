export const GROUPS = ['Vermelho', 'Amarelo', 'Verde', 'Azul', 'Roxo'];

export const getGroupColor = (groupName) => {
  const colors = {
    'Verde': { 
      bg: 'bg-green-500/10', 
      border: 'border-green-500/30', 
      hoverBorder: 'hover:border-green-500/60',
      text: 'text-green-500', 
      badge: 'bg-green-500/20 text-green-300',
      hex: '#22c55e' 
    },
    'Amarelo': { 
      bg: 'bg-yellow-500/10', 
      border: 'border-yellow-500/30', 
      hoverBorder: 'hover:border-yellow-500/60',
      text: 'text-yellow-500', 
      badge: 'bg-yellow-500/20 text-yellow-300',
      hex: '#eab308' 
    },
    'Azul': { 
      bg: 'bg-blue-500/10', 
      border: 'border-blue-500/30', 
      hoverBorder: 'hover:border-blue-500/60',
      text: 'text-blue-500', 
      badge: 'bg-blue-500/20 text-blue-300',
      hex: '#3b82f6' 
    },
    'Roxo': { 
      bg: 'bg-purple-500/10', 
      border: 'border-purple-500/30', 
      hoverBorder: 'hover:border-purple-500/60',
      text: 'text-purple-500', 
      badge: 'bg-purple-500/20 text-purple-300',
      hex: '#a855f7' 
    },
    'Vermelho': { 
      bg: 'bg-red-500/10', 
      border: 'border-red-500/30', 
      hoverBorder: 'hover:border-red-500/60',
      text: 'text-red-500', 
      badge: 'bg-red-500/20 text-red-300',
      hex: '#ef4444' 
    },
  };
  return colors[groupName] || { 
    bg: 'bg-gray-500/10', 
    border: 'border-gray-500/30', 
    hoverBorder: 'hover:border-gray-500/60',
    text: 'text-gray-500',
    badge: 'bg-gray-500/20 text-gray-300',
    hex: '#6b7280' 
  };
};

export const getGroupStats = (groupAcampantes) => {
  if (!groupAcampantes) return { total: 0, homens: 0, mulheres: 0 };
  const homens = groupAcampantes.filter(a => a.sexo?.toLowerCase() === 'masculino').length;
  const mulheres = groupAcampantes.filter(a => a.sexo?.toLowerCase() === 'feminino').length;
  return { total: groupAcampantes.length, homens, mulheres };
};

// Agrupa acampantes pelo grupo de trilha já persistido no banco (coluna
// acampantes.grupo_trailha, preenchida uma única vez no momento da aprovação por
// src/services/acampantesService.js). Substitui a antiga allocateAcampantesToGroups,
// que recalculava tudo em memória a cada carregamento — agora só exibe o que já
// foi decidido e salvo.
export const groupAcampantesByTrilha = (acampantes) => {
  const groups = {
    'Verde': [],
    'Amarelo': [],
    'Azul': [],
    'Roxo': [],
    'Vermelho': []
  };

  (acampantes || []).forEach(a => {
    if (a.grupo_trailha && groups[a.grupo_trailha]) {
      groups[a.grupo_trailha].push(a);
    }
  });

  return groups;
};