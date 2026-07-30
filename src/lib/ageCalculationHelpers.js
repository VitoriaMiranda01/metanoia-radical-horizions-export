export const calculateAgeFromBirthdate = (birthdate) => {
  if (!birthdate) return null;
  
  const birthDateObj = new Date(birthdate);
  
  // Check for invalid date
  if (isNaN(birthDateObj.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDateObj.getFullYear();
  const m = today.getMonth() - birthDateObj.getMonth();
  
  if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
    age--;
  }
  
  return age;
};