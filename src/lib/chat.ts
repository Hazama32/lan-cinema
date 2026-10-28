export type ChatMsg = {
  id: string;
  sid: string; // id socket pengirim (untuk badge HOST dan gelembung "Anda")
  from: string;
  text: string;
  t: number | null; // posisi video (detik) saat pesan dikirim, bila ditandai
  at: number; // ms
};

export const REACTIONS = ["🔥", "😱", "❤️", "🚀", "🍿", "🤯"] as const;