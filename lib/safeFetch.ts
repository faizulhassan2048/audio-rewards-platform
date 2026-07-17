export async function safeFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<T | null> {
  try {
    const res = await fetch(url, options);
    
    // ✅ Check if response is ok
    if (!res.ok) {
      console.warn(`⚠️ API returned ${res.status}: ${url}`);
      return null;
    }

    // ✅ Read as text first
    const text = await res.text();
    
    // ✅ Handle empty response
    if (!text || text.trim() === '') {
      console.warn(`⚠️ Empty response from: ${url}`);
      return null;
    }

    // ✅ Parse JSON safely
    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error(`❌ JSON parse error for: ${url}`, parseError);
      console.log('Response text:', text.substring(0, 200));
      return null;
    }
  } catch (error) {
    console.error(`❌ Fetch error for: ${url}`, error);
    return null;
  }
}