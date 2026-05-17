export const metadata = {
  title: "Rifa da Julya",
  description: "Rifa beneficente para cirurgia da Julya"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
