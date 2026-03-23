export function phoneticTransform(text) {
  if (!text) return "";
  
  let result = text;

  // 1. Protect manual 'O' (from ZWNJ)
  result = result.replace(/O/g, "PROTECT_O"); 

  // 2. Handle 'yo' -> 'oy' ONLY if followed by space or end of string
  // This prevents the 'y' logic from messing with punctuation like '.'
  //result = result.replace(/yo(?=\s|$)/g, "oy"); 

  // 3. Clean up any automatic 'o' that was mistakenly added before punctuation
  // This covers . , ! ? ; and the Bengali Danda ।
  result = result.replace(/o(?=[.,!?;।])/g, "");

  // 4. Restore manual 'O'
  result = result.replace(/PROTECT_O/g, "o"); 
  
  // 5. Remove Halanta residues
  result = result.replace(/্+o/g, "");
  
  return result.toLowerCase().trim();
}