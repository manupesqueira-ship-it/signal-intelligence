import './globals.css'

export const metadata = {
  title: 'Signal — Intelligence Scouting',
  description: 'Briefing diario de startups, AI y oportunidades de negocio emergentes',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
