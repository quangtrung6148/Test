import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nhịp — Mini Task App',
  description: 'Một nơi nhỏ để ghi lại công việc và từng bước hoàn thành.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
