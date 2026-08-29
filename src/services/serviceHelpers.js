// Helpers internos compartilhados entre os arquivos de src/services/.
// Extraídos de organizerHelpers.js durante a reorganização — comportamento inalterado.

export const handleSupabaseError = (error, context) => {
  if (error) {
    console.error(`Error in ${context}:`, error.message || error);
    throw new Error(error.message || 'Unknown error occurred');
  }
};

export const withRetry = async (operation, retries = 3, delay = 1000) => {
  try {
    return await operation();
  } catch (error) {
    if (retries <= 0) throw error;
    const isNetworkError = error.message === 'Failed to fetch' || error.status >= 500;
    if (!isNetworkError) throw error;
    console.warn(`Retrying operation... (${retries} attempts left)`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(operation, retries - 1, delay * 2);
  }
};
