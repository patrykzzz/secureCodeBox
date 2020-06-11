const { startSubsequentSecureCodeBoxScan } = require("./scan-helpers");

async function handle({ 
  scan, 
  getFindings,
  cascadeAmassNmap        = process.env["CASCADE_AMASS_NMAP"],
  cascadeNmapSsl          = process.env["CASCADE_NMAP_SSL"],
  cascadeNmapSsh          = process.env["CASCADE_NMAP_SSH"],
  cascadeNmapNikto        = process.env["CASCADE_NMAP_NIKTO"],
  cascadeNmapSmb          = process.env["CASCADE_NMAP_SMB"],
  cascadeNmapZapBaseline  = process.env["CASCADE_NMAP_ZAP_BASELINE"]
}) {
  const findings = await getFindings();

  console.log(findings);
  console.log("cascadeAmassNmap: " + cascadeAmassNmap);
  console.log("cascadeNmapSsl: " + cascadeNmapSsl);
  console.log("cascadeNmapSsh: " + cascadeNmapSsh);
  console.log("cascadeNmapNikto: " + cascadeNmapNikto);
  console.log("cascadeNmapSmb: " + cascadeNmapSmb);
  console.log("cascadeNmapZapBaseline: " + cascadeNmapZapBaseline);

  console.log(
    `Found #${findings.length} findings... Trying to find identify if these are NMAP specific findings and start possible subsequent security scans.`
  );

  for (const finding of findings) {
    if (
      finding.category === "Open Port" &&
      finding.attributes.state === "open"
    ) {
      const hostname = finding.attributes.hostname;
      const port = finding.attributes.port;

      console.log(
        "Found NMAP 'Open Port' finding for port: '" + finding.attributes.port+"' and service: '" + finding.attributes.service + "'"
      );

      // search for HTTP ports and start subsequent Nikto Scan
      if (
        cascadeNmapNikto && 
        finding.attributes.service === "http"
      ) {
        await startNiktoScan({
          parentScan: scan,
          hostname,
          port,
        });
      }

      // search for SMB ports and start subsequent NMAP Scan
      if (
        cascadeNmapSmb && 
        finding.attributes.port === 445 && 
        finding.attributes.service === "microsoft-ds"
      ) {
        await startSMBScan({
          parentScan: scan,
          hostname,
          port,
        });
      }

      // search for HTTPS ports and start subsequent SSLyze Scan
      if (
        cascadeNmapSsl && 
        (finding.attributes.service === "ssl" ||
        finding.attributes.service === "https")
      ) {
        await startSSLyzeScan({
          parentScan: scan,
          hostname,
          port,
        });
      }

      // search for HTTPS ports and start subsequent ZAP Baselne Scan
      if (
        cascadeNmapZapBaseline && 
        (finding.attributes.service === "ssl" ||
        finding.attributes.service === "https")
      ) {
        await startZAPBaselineScan({
          parentScan: scan,
          hostname,
          port,
        });
      }

      // search for HTTPS ports and start subsequent SSH Scan
      if (
        cascadeNmapSsh &&
        finding.attributes.service === "ssh"
      ) {
        await startSSHScan({
          parentScan: scan,
          hostname,
          port,
        });
      }
    }
  }

  console.log(
    `Found  #${findings.length} findings... Trying to find identify if these are AMASS specific findings and start possible subsequent security scans.`
  );

  for (const finding of findings) {
    if(
      cascadeAmassNmap &&
      finding.category === "Subdomain" && 
      finding.osi_layer === "NETWORK" && 
      finding.description.startsWith("Found subdomain"
    )) {
      console.log("Found AMASS 'Subdomain' finding: " + finding.location);

      const hostname = finding.location;
      
      await startNMAPScan({
        parentScan: scan,
        hostname
      });
    }
  }
}

/**
 * Creates a new subsequent SCB ZAP Scan for the given hostname.
 * @param {string} hostname The hostname to start a new subsequent ZAP scan for.
 * @param {string} port The port to start a new subsequent ZAP scan for.
 */
async function startSMBScan({ parentScan, hostname}) {
  console.log(
    " --> Starting async subsequent NMAP SMB Scan for host: " + hostname
  );

  await startSubsequentSecureCodeBoxScan({
    parentScan,
    name: `nmap-smb-${hostname.toLowerCase()}`,
    scanType: "nmap",
    parameters: ["-Pn", "-p445", "--script", "smb-protocols", hostname],
  });
}

/**
 * Creates a new subsequent SCB ZAP Scan for the given hostname.
 * @param {string} hostname The hostname to start a new subsequent ZAP scan for.
 * @param {string} port The port to start a new subsequent ZAP scan for.
 */
async function startNMAPScan({ parentScan, hostname}) {
  console.log(
    " --> Starting async subsequent NMAP Scan for host: " + hostname
  );

  await startSubsequentSecureCodeBoxScan({
    parentScan,
    name: `nmap-${hostname.toLowerCase()}`,
    scanType: "nmap",
    parameters: ["-Pn", hostname],
  });
}

/**
 * Creates a new subsequent SCB ZAP Scan for the given hostname.
 * @param {string} hostname The hostname to start a new subsequent ZAP scan for.
 * @param {string} port The port to start a new subsequent ZAP scan for.
 */
async function startZAPBaselineScan({ parentScan, hostname, port }) {
  console.log(
    " --> Starting async subsequent ZAP Scan for host: " + hostname + ":" + port
  );

  await startSubsequentSecureCodeBoxScan({
    parentScan,
    name: `zap-${hostname.toLowerCase()}`,
    scanType: "zap-baseline",
    parameters: ["-t", "https://" + hostname + ":" + port],
  });
}

/**
 * Creates a new subsequent SCB SSH Scan for the given hostname.
 * @param {string} hostname The hostname to start a new subsequent SSH scan for.
 * @param {string} port The port to start a new subsequent SSH scan for.
 */
async function startSSHScan({ parentScan, hostname, port }) {
  console.log(
    " --> Starting async subsequent SSH Scan for host: " + hostname + ":" + port
  );

  await startSubsequentSecureCodeBoxScan({
    parentScan,
    name: `ssh-${hostname.toLowerCase()}`,
    scanType: "ssh-scan",
    parameters: ["-t", hostname],
  });
}

/**
 * Creates a new subsequent SCB Nikto Scan for the given hostname.
 * @param {string} hostname The hostname to start a new subsequent Nikto scan for.
 * @param {string} port The port to start a new subsequent Nikto scan for.
 */
async function startNiktoScan({ parentScan, hostname, port }) {
  console.log(
    " --> Starting async subsequent Nikto Scan for host: " + hostname + ":" + port
  );

  await startSubsequentSecureCodeBoxScan({
    parentScan,
    name: `nikto-${hostname.toLowerCase()}`,
    scanType: "nikto",
    parameters: ["-h", "https://" + hostname, "-Tuning", "1,2,3,5,7,b"],
  });
}

/**
 * Creates a new subsequent SCB SSLyze Scan for the given hostname.
 * @param {string} hostname The hostname to start a new subsequent SSLyze scan for.
 * @param {string} port The port to start a new subsequent SSLyze scan for.
 */
async function startSSLyzeScan({ parentScan, hostname, port }) {
  console.log(
    " --> Starting async subsequent SSLyze Scan for host: " + hostname + ":" + port
  );

  await startSubsequentSecureCodeBoxScan({
    parentScan,
    name: `sslyze-${hostname.toLowerCase()}`,
    scanType: "sslyze",
    parameters: ["--regular", hostname],
  });
}

module.exports.handle = handle;
