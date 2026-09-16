import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist', 'extreme-angular', 'browser');
const screenshotsDir = path.join(projectRoot, 'docs', 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

// Mock clinical response for realistic demo screenshots
const mockClinicalResponse = {
  success: true,
  summary: "Patient John Smith is a 54-year-old male with a history of Essential Hypertension and Type 2 Diabetes Mellitus. Recent observations show elevated Blood Pressure (142/90 mmHg) and Hemoglobin A1c (7.8%), suggesting suboptimal glycemic and blood pressure control on current therapy. Active medications include Metformin 1000mg BID and Lisinopril 20mg daily.",
  llmUsed: true,
  provider: "openrouter (claude-3.5-haiku)",
  suggestedActions: [
    {
      id: "action-a1c",
      title: "Intensify Glycemic Therapy",
      description: "Consider adding an SGLT2 inhibitor (e.g. Empagliflozin 10mg) given elevated HbA1c of 7.8% and proven cardiovascular benefit.",
      priority: "urgent",
      category: "therapeutic"
    },
    {
      id: "action-bp",
      title: "Ambulatory Blood Pressure Monitoring",
      description: "Order 24-hour ambulatory BP monitoring or 2-week home BP log to confirm stage 2 hypertension pattern.",
      priority: "routine",
      category: "monitoring"
    },
    {
      id: "action-labs",
      title: "Order Comprehensive Metabolic Panel & Urine ACR",
      description: "Evaluate renal function and screen for diabetic nephropathy before adjusting antihypertensive regimen.",
      priority: "routine",
      category: "diagnostic"
    }
  ],
  taskGeneration: {
    summary: "Generated clinical action plan for cardiovascular and metabolic risk reduction.",
    carePlan: {
      resourceType: "CarePlan",
      id: "cp-2026-demo",
      title: "Cardiometabolic Care Optimization Plan",
      status: "active",
      intent: "plan"
    },
    tasks: [
      {
        resourceType: "Task",
        id: "task-sglt2",
        status: "requested",
        priority: "urgent",
        code: { text: "Evaluate SGLT2 inhibitor addition for diabetic nephroprotection" },
        description: "Review contraindications and eGFR prior to initiating Empagliflozin 10mg PO daily"
      },
      {
        resourceType: "Task",
        id: "task-uacr",
        status: "requested",
        priority: "routine",
        code: { text: "Order Urine Albumin-to-Creatinine Ratio (uACR)" },
        description: "Screen for early diabetic microalbuminuria"
      }
    ]
  },
  isStructuredResponse: true
};

// Create local static server with mock API support
const PORT = 4200;
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Handle LLM API mock
  if (pathname.startsWith('/api/llm') || pathname.startsWith('/llm')) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(mockClinicalResponse));
    return;
  }

  // Handle tasks API mock
  if (pathname.startsWith('/api/tasks')) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ success: true, tasks: [] }));
    return;
  }

  // File resolution
  let filePath = path.join(distDir, pathname);
  if (pathname === '/' || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (fs.existsSync(filePath) && fs.existsSync(path.join(filePath, 'index.html'))) {
      filePath = path.join(filePath, 'index.html');
    } else {
      filePath = path.join(distDir, 'index.html');
    }
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found: ' + err.message);
  }
});

async function capture() {
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`Local test server running at http://127.0.0.1:${PORT}`);

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  console.log('Launching headless Chrome...');
  
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1440,920',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 920, deviceScaleFactor: 2 });

  try {
    console.log('Navigating to NiskaChat...');
    await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'networkidle0' });

    // 1. Landing Screen (File Upload / Offline Mode)
    console.log('Capturing 01-landing-offline-mode.png...');
    await page.screenshot({
      path: path.join(screenshotsDir, '01-landing-offline-mode.png'),
      fullPage: false,
    });

    // 2. Click "Load John Smith Data"
    console.log('Loading John Smith patient bundle...');
    const exampleButton = await page.waitForSelector('.example-button');
    if (exampleButton) {
      await exampleButton.click();
    }

    // Wait for patient header to appear
    await page.waitForSelector('.patient-name', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));

    console.log('Capturing 02-patient-records.png...');
    await page.screenshot({
      path: path.join(screenshotsDir, '02-patient-records.png'),
      fullPage: false,
    });

    // 3. Click on chart icon to show Chart.js visualization
    console.log('Opening Chart.js observation visualization...');
    await page.evaluate(() => {
      const chartSection = document.querySelector('app-observations-chart');
      if (chartSection) {
        chartSection.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    // Find and click the first chart button (A1c or BP)
    const chartButton = await page.$('.obs-actions button');
    if (chartButton) {
      console.log('Clicked observation chart button...');
      await chartButton.click();
      await new Promise((r) => setTimeout(r, 1500));
    }

    console.log('Capturing 03-observation-charts.png...');
    await page.screenshot({
      path: path.join(screenshotsDir, '03-observation-charts.png'),
      fullPage: false,
    });

    // Reset scroll
    await page.evaluate(() => window.scrollTo(0, 0));

    // 4. Click Discuss Tab
    console.log('Switching to Discuss tab...');
    const tabs = await page.$$('.custom-tab-button');
    if (tabs.length > 1) {
      await tabs[1].click(); // Tab index 1 = Discuss
      await new Promise((r) => setTimeout(r, 1200));

      // Trigger summarize button
      const summarizeBtn = await page.$('.header-actions button:first-child');
      if (summarizeBtn) {
        console.log('Triggering AI clinical summary...');
        await summarizeBtn.click();
        await new Promise((r) => setTimeout(r, 2000));
      }

      console.log('Capturing 04-clinical-ai-discuss.png...');
      await page.screenshot({
        path: path.join(screenshotsDir, '04-clinical-ai-discuss.png'),
        fullPage: false,
      });
    }

    // 5. Click Tasks Tab
    console.log('Switching to Tasks tab...');
    const updatedTabs = await page.$$('.custom-tab-button');
    if (updatedTabs.length > 2) {
      await updatedTabs[2].click(); // Tab index 2 = Tasks
      await new Promise((r) => setTimeout(r, 1200));

      console.log('Capturing 05-fhir-careplan-tasks.png...');
      await page.screenshot({
        path: path.join(screenshotsDir, '05-fhir-careplan-tasks.png'),
        fullPage: false,
      });
    }

    // 6. Dark Mode
    console.log('Toggling Dark Mode...');
    const themeBtn = await page.$('app-theme-toggle button');
    if (themeBtn) {
      await themeBtn.click();
      await new Promise((r) => setTimeout(r, 800));
      console.log('Capturing 06-dark-mode.png...');
      await page.screenshot({
        path: path.join(screenshotsDir, '06-dark-mode.png'),
        fullPage: false,
      });
    }

    console.log('✅ All screenshots captured successfully in docs/screenshots/!');
  } catch (err) {
    console.error('Error during screenshot capture:', err);
  } finally {
    await browser.close();
    server.close();
  }
}

capture();
