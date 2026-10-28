// Label kualitas dari tinggi video. Film layar lebar (mis. 1920×800) tingginya
// di bawah 1080, jadi batasnya sengaja longgar.
export function qualityLabel(height: number) {
  if (height >= 1500) return "4K";
  if (height >= 750) return "1080p";
  if (height >= 500) return "720p";
  return "";
}