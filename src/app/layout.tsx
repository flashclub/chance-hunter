import Script from "next/script";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="beforeInteractive"
        />
      </head>

      <body>{children}</body>
    </html>
  );
}
