export const metadata = {
  title: "Argos Intelligence",
  description: "Institutional Predictive Intelligence Platform"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
