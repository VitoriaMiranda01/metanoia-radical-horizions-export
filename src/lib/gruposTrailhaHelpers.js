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
  const homens = groupAcampantes.filter(a => a.genero?.toLowerCase() === 'masculino').length;
  const mulheres = groupAcampantes.filter(a => a.genero?.toLowerCase() === 'feminino').length;
  return { total: groupAcampantes.length, homens, mulheres };
};

export const allocateAcampantesToGroups = (acampantes) => {
  // Only consider approved or confirmed acampantes
  const approved = acampantes.filter(a => 
    a.status === 'aprovado' || a.status === 'confirmado'
  );
  
  const homens = approved.filter(a => a.genero?.toLowerCase() === 'masculino');
  const mulheres = approved.filter(a => a.genero?.toLowerCase() === 'feminino');
  
  const groups = {
    'Verde': [],
    'Amarelo': [],
    'Azul': [],
    'Roxo': [],
    'Vermelho': []
  };
  
  // Distribute Homens (Round Robin)
  homens.forEach((h, index) => {
    const groupName = GROUPS[index % 5];
    groups[groupName].push(h);
  });
  
  // Distribute Mulheres (Round Robin)
  mulheres.forEach((m, index) => {
    const groupName = GROUPS[index % 5];
    groups[groupName].push(m);
  });
  
  return groups;
};