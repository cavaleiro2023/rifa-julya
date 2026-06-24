export const metadata = {
  title: "Rifa da Julya",
  description: "Rifa beneficente para cirurgia da Julya",
  charset: "utf-8",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="UTF-8" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
