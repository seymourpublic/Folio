import type { Metadata } from "next";
import { Callout, Prose } from "@/components/prose";
import { latestAsset, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Installation",
  description: "Install Folio on Windows, or build it from source on any platform.",
  alternates: { canonical: "/docs/installation" },
};

export default function InstallationPage() {
  return (
    <>
      <h1 className="text-4xl font-semibold">Installation</h1>

      <Prose>
        <p>
          Folio ships as a Windows installer. Download it for the quickest start, or
          build from source on any platform if you would rather run code you have read.
        </p>

        <h2>Windows</h2>
        <ol>
          <li>
            Download <code>Folio-Setup-{site.version}.exe</code> from the{" "}
            <a href={latestAsset(`Folio-Setup-${site.version}.exe`)}>
              releases page
            </a>
            .
          </li>
          <li>Run the installer.</li>
          <li>
            SmartScreen will warn that the publisher is unknown. Choose{" "}
            <strong>More info</strong>, then <strong>Run anyway</strong>.
          </li>
        </ol>
        <p>Requires Windows 10 or later, 64-bit.</p>

        <h2>macOS and Linux</h2>
        <p>
          Installers for macOS and Linux are not published yet. Folio is an Electron
          app, so you can run it on either today by building from source, below.
          Disk image and AppImage releases are on the roadmap.
        </p>

        <Callout title="Why are the builds unsigned?">
          Code signing certificates are a recurring annual cost, and Folio is a pre-1.0
          project that has not taken that on yet. Signing and notarization are on the
          roadmap. Building from source avoids the question entirely.
        </Callout>

        <h2>Building from source</h2>
        <p>
          You need <strong>Node.js 20.9 or later</strong>. Check with{" "}
          <code>node --version</code>.
        </p>
        <pre>
          <code>{`git clone ${site.repo}.git
cd folio
npm install`}</code>
        </pre>
        <p>The install covers the application and its workspace packages. Then:</p>
        <pre>
          <code>{`npm run electron:dev     # the desktop app, with hot reload
npm run dev              # browser only, at http://localhost:3000`}</code>
        </pre>
        <p>
          The browser mode is the fastest loop for interface work, but anything using
          native file dialogs, watched folders or trusted timestamps needs{" "}
          <code>electron:dev</code>, because those go through the desktop shell.
        </p>

        <h3>Producing an installer</h3>
        <pre>
          <code>npm run electron:build</code>
        </pre>
        <p>
          This runs a static export and then electron-builder. Artifacts land in{" "}
          <code>../PDF-electron-dist</code>, next to the repository. On Windows,{" "}
          <code>npm run electron:dist:win</code> produces an unpacked directory, which is
          faster when you only need to test that the desktop shell works.
        </p>

        <Callout title="Building on your own platform only">
          electron-builder produces installers for the platform you run it on. Building a
          macOS DMG requires macOS. Cross-platform release builds are normally done in
          CI.
        </Callout>

        <h2>Uninstalling</h2>
        <p>
          Use the standard uninstaller on Windows, drag the app to the Trash on macOS, or
          delete the AppImage on Linux. Because Folio keeps its library, search index and
          certificates in local application storage, uninstalling removes those too. The
          original PDFs on your disk are never modified or moved by Folio, so they are
          unaffected.
        </p>
      </Prose>
    </>
  );
}
