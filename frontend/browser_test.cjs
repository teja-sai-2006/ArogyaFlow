const { firefox } = require('playwright');
const fs = require('fs');
const path = require('path');

async function runBrowserTests() {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('🚀 Launching Firefox browser for end-to-end browser testing...');
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('  [BROWSER ERROR]', msg.text());
  });

  const results = [];
  function assert(title, condition, extra = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${title} ${extra}`);
      results.push({ title, status: 'PASS', extra });
    } else {
      console.error(`  ❌ FAIL: ${title} ${extra}`);
      results.push({ title, status: 'FAIL', extra });
      throw new Error(`Assertion failed: ${title}`);
    }
  }

  try {
    // 1. Visit Home / Login Screen
    console.log('\n🌐 1. Navigating to http://localhost:5173/ ...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    const title = await page.title();
    assert('Page Title', title.includes('ArogyaFlow'), `(Got "${title}")`);
    
    // Check Brand and 1-Click Demo Accounts
    const pageContent = await page.content();
    assert('Brand Title Rendered', pageContent.includes('ArogyaFlow (ఆరోగ్యఫ్లో)'));
    assert('1-Click Quick Demo Access Banner', pageContent.includes('1-Click Quick Demo Access'));

    await page.screenshot({ path: path.join(screenshotsDir, '01_login_portal.png') });
    console.log('  📸 Screenshot captured: 01_login_portal.png');

    // Helper to switch user via navbar
    async function switchRoleViaNavbar(userName, expectedText) {
      // Click the navbar switch role button
      await page.locator('button:has-text("Switch Role")').click();
      await page.waitForTimeout(300);
      // Click the user item in dropdown
      await page.locator(`button:has-text("${userName}")`).first().click();
      // Wait for expected header
      await page.waitForSelector(`text=${expectedText}`, { timeout: 6000 });
      await page.waitForTimeout(500);
    }

    // 2. Click Super Admin 1-Click Login Card on Login Screen
    console.log('\n👑 2. Testing Super Admin Dashboard...');
    const superAdminBtn = page.locator('button:has-text("SUPER_ADMIN")').first();
    await superAdminBtn.click();
    await page.waitForSelector('text=National Emergency', { timeout: 6000 });
    const isSuperVisible = await page.locator('text=National Emergency').isVisible();
    assert('Super Admin Dashboard Rendered', isSuperVisible);
    const isDisasterVisible = await page.locator('text=Feature 1.2: Regional Disaster Alert').isVisible();
    assert('Regional Disaster Command Present', isDisasterVisible);
    await page.screenshot({ path: path.join(screenshotsDir, '02_super_admin.png') });
    console.log('  📸 Screenshot captured: 02_super_admin.png');

    // 3. Switch to Hospital Admin via Navbar Switcher
    console.log('\n🏥 3. Testing Hospital Admin Dashboard...');
    await switchRoleViaNavbar('V. S. Murthy', 'Hospital Admin Portal');
    assert('Hospital Admin Dashboard Rendered', await page.locator('text=Hospital Admin Portal').isVisible());
    assert('Staff Roster Rendered', await page.locator('text=Hospital Staff Roster').isVisible());
    assert('Dr. Rajesh Varma in Roster', await page.locator('text=Dr. Rajesh Varma').first().isVisible());
    await page.screenshot({ path: path.join(screenshotsDir, '03_hospital_admin.png') });
    console.log('  📸 Screenshot captured: 03_hospital_admin.png');

    // 4. Switch to Hospital Management via Navbar Switcher
    console.log('\n📊 4. Testing Hospital Management Dashboard...');
    await switchRoleViaNavbar('Sravani Rao', 'Hospital Management & Live Triage');
    assert('Hospital Mgmt Dashboard Rendered', await page.locator('text=Hospital Management & Live Triage').isVisible());
    assert('Live Triage Queue Present', await page.locator('text=Live Triage & Booking Queue').isVisible());
    assert('Bed & Blood Console Present', await page.locator('text=Bed & Blood Inventory Console').isVisible());
    await page.screenshot({ path: path.join(screenshotsDir, '04_hospital_mgmt.png') });
    console.log('  📸 Screenshot captured: 04_hospital_mgmt.png');

    // 5. Switch to Doctor Workspace
    console.log('\n🩺 5. Testing Doctor Clinical Workspace...');
    await switchRoleViaNavbar('Dr. Rajesh Varma', 'Doctor Clinical Workspace');
    assert('Doctor Workspace Rendered', await page.locator('text=Doctor Clinical Workspace').isVisible());
    assert('Patient Queue Present', await page.locator('text=Assigned Patient Queue').isVisible());
    assert('Write Prescription Module Present', await page.locator('text=Write Prescription').isVisible());
    assert('Order Lab Scan Module Present', await page.locator('text=Order Lab Scan').isVisible());
    await page.screenshot({ path: path.join(screenshotsDir, '05_doctor_workspace.png') });
    console.log('  📸 Screenshot captured: 05_doctor_workspace.png');

    // 6. Switch to Lab Technician Workspace
    console.log('\n🔬 6. Testing Lab Technician Diagnostic Worklist...');
    await switchRoleViaNavbar('G. Praveen', 'Lab Technician Diagnostic Worklist');
    assert('Lab Tech Dashboard Rendered', await page.locator('text=Lab Technician Diagnostic Worklist').first().isVisible());
    assert('Pending Diagnostic Orders List Present', await page.locator('text=Pending Diagnostic Orders').first().isVisible());
    assert('Upload Scan Module Present', await page.locator('text=Upload Report / Scan File').first().isVisible());
    await page.screenshot({ path: path.join(screenshotsDir, '06_lab_tech.png') });
    console.log('  📸 Screenshot captured: 06_lab_tech.png');

    // 7. Switch to Blood Bank Portal
    console.log('\n🩸 7. Testing Blood Bank Live Inventory & Donor Outreach...');
    await switchRoleViaNavbar('Rotary Blood Bank', 'Blood Bank Live Inventory');
    assert('Blood Bank Dashboard Rendered', await page.locator('text=Blood Bank Live Inventory').first().isVisible());
    assert('Live Blood Units Present', await page.locator('text=Live Blood Units Available').first().isVisible());
    assert('Registered Volunteer Donors Present', await page.locator('text=Registered Volunteer Donors').first().isVisible());
    await page.screenshot({ path: path.join(screenshotsDir, '07_blood_bank.png') });
    console.log('  📸 Screenshot captured: 07_blood_bank.png');

    // 8. Switch to Medical Store / Pharmacy
    console.log('\n🏪 8. Testing Medical Store & Comparison Stock...');
    await switchRoleViaNavbar('Sanjeevani MedPlus', 'Medical Store & Pharmacy');
    assert('Pharmacy Dashboard Rendered', await page.locator('text=Medical Store & Pharmacy').first().isVisible());
    assert('Stock Inventory Present', await page.locator('text=Current Stock Inventory').first().isVisible());
    assert('Early Closing Broadcast Present', await page.locator('text=Early Closing SMS Broadcast').first().isVisible());
    await page.screenshot({ path: path.join(screenshotsDir, '08_medical_store.png') });
    console.log('  📸 Screenshot captured: 08_medical_store.png');

    // 9. Switch to Patient Portal
    console.log('\n👤 9. Testing Patient Portal & End-to-End Features...');
    await switchRoleViaNavbar('Kiran Kumar', 'Kiran Kumar');
    assert('Patient Dashboard Rendered', await page.locator('text=Kiran Kumar').first().isVisible());
    assert('UHID Displayed', await page.locator('text=UHID-2026-0001').first().isVisible());

    // Test 9a: Medicine Availability & Price Finder by City (NEW FEATURE!)
    console.log('  🏬 Testing Medicine Finder by City in browser...');
    assert('Medicine Finder Tab Active', await page.locator('text=Medicine Availability & Price Finder by City').first().isVisible());
    
    // Type medicine query
    await page.fill('input[placeholder*="Dolo, Augmentin"]', 'Dolo');
    await page.waitForTimeout(500);
    assert('Dolo Listings Rendered', await page.locator('text=Dolo 650').first().isVisible());
    
    // Filter by City: Vijayawada
    console.log('  🌆 Testing City Filter (Vijayawada)...');
    await page.selectOption('select:has(option[value="Vijayawada"])', 'Vijayawada');
    await page.waitForTimeout(600);
    assert('Vijayawada Store Rendered', await page.locator('text=Krishna Valley Medico').first().isVisible());
    
    // Test Dose Reservation
    await page.locator('button:has-text("Reserve Dose")').first().click();
    await page.waitForTimeout(500);
    assert('Reservation Confirmation Toast', await page.locator('text=Reserved 1 unit').first().isVisible());
    await page.screenshot({ path: path.join(screenshotsDir, '09_patient_medicine_finder_city.png') });
    console.log('  📸 Screenshot captured: 09_patient_medicine_finder_city.png');

    // Test 9b: Switch to Emergency SOS Tab & Trigger SOS
    console.log('  🚨 Triggering One-Tap Emergency SOS in browser...');
    await page.click('button:has-text("Emergency SOS")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("PRESS FOR SOS")');
    await page.waitForSelector('text=LIVE PRE-ARRIVAL DISPATCH COMPLETE', { timeout: 8000 });
    assert('Pre-Arrival Dispatch Card Displayed', await page.locator('text=LIVE PRE-ARRIVAL DISPATCH COMPLETE').first().isVisible());
    assert('Bed Locked Status Rendered', await page.locator('text=ICU Trauma Bed Successfully Locked').first().isVisible());
    assert('Blood Verification Rendered', await page.locator('text=Pre-Arrival Blood Verification').first().isVisible());
    await page.screenshot({ path: path.join(screenshotsDir, '10_patient_emergency_sos.png') });
    console.log('  📸 Screenshot captured: 10_patient_emergency_sos.png');

    // Test 9c: Multilingual AI Triage & Voice Tab
    console.log('  🤖 Testing Multilingual AI Triage & Voice-to-Type in browser...');
    await page.click('button:has-text("Multilingual AI Triage")');
    await page.waitForTimeout(500);
    assert('Voice to Type Button Present', await page.locator('text=Voice to Type').first().isVisible());
    assert('Gemini Model Badge Present', await page.locator('text=Gemini 2.0 Flash').first().isVisible());

    // Test Quick Telugu Voice Chip
    console.log('  🗣️ Testing Telugu Voice Symptom Chip...');
    await page.click('button:has-text("గుండె నొప్పి")');
    await page.waitForTimeout(300);

    // Run Triage
    await page.click('button:has-text("Run Multilingual AI Triage")');
    await page.waitForSelector('text=Severity:', { timeout: 8000 });
    assert('AI Triage Result Displayed', await page.locator('text=Severity:').first().isVisible());
    assert('Telugu Voice Advice Card Displayed', await page.locator('text=Spoken Doctor\'s Voice Advice (తెలుగు)').first().isVisible());
    assert('Listen to Advice Audio Button Present', await page.locator('text=Listen to Advice').first().isVisible());
    await page.screenshot({ path: path.join(screenshotsDir, '11_patient_ai_triage.png') });
    console.log('  📸 Screenshot captured: 11_patient_ai_triage.png');

    // Test 9d: Hospital Discovery ("Table" Filter) Tab
    console.log('  🏥 Testing Hospital Discovery Table Filter in browser...');
    await page.click('button:has-text("Hospital Discovery")');
    await page.waitForTimeout(800);
    assert('Hospital Table Rendered', await page.locator('text=Apollo Speciality Hospital').first().isVisible());
    assert('Safe Zone Hospital Listed', await page.locator('text=Care Super Speciality Hospital').first().isVisible());
    assert('Local Clinic Listed', await page.locator('text=Seethammadhara Urban Primary Health Clinic').first().isVisible());
    await page.screenshot({ path: path.join(screenshotsDir, '12_patient_hospitals_table.png') });
    console.log('  📸 Screenshot captured: 12_patient_hospitals_table.png');

    // Test 9e: Smart Medicine Analyzer Tab
    console.log('  🔍 Testing Smart Medicine Analyzer Tab in browser...');
    await page.click('button:has-text("Medicine Strip Analyzer")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Analyze Medicine")');
    await page.waitForSelector('text=Amoxicillin + Clavulanic Acid', { timeout: 6000 });
    assert('Medicine Analyzer Identification Rendered', await page.locator('text=Amoxicillin + Clavulanic Acid').first().isVisible());
    await page.screenshot({ path: path.join(screenshotsDir, '13_patient_medicine_analyzer.png') });
    console.log('  📸 Screenshot captured: 13_patient_medicine_analyzer.png');

    // Test 9f: Generic Price Comparison Tab
    console.log('  💊 Testing Generic Price Comparison Table in browser...');
    await page.click('button:has-text("Generic Price Comparison")');
    await page.waitForTimeout(800);
    assert('Generic Comparison Table Rendered', await page.locator('text=Jan Aushadhi Kendra').first().isVisible());
    assert('Best Price Badge Rendered', await page.locator('text=Best Price').first().isVisible());
    assert('Sanjeevani MedPlus Rendered', await page.locator('text=Sanjeevani MedPlus').first().isVisible());
    assert('Apollo Pharmacy Rendered', await page.locator('text=Apollo Pharmacy').first().isVisible());
    await page.screenshot({ path: path.join(screenshotsDir, '14_patient_generic_comparison.png') });
    console.log('  📸 Screenshot captured: 14_patient_generic_comparison.png');

    // Test 9g: Reports & Scans Vault Tab
    console.log('  📁 Testing Reports & Scans Vault Tab in browser...');
    await page.click('button:has-text("Reports & Scans Vault")');
    await page.waitForTimeout(800);
    assert('Patient Vault Rendered', await page.locator('text=Personal Reports and Scans Vault').first().isVisible());
    await page.screenshot({ path: path.join(screenshotsDir, '15_patient_vault.png') });
    console.log('  📸 Screenshot captured: 15_patient_vault.png');

    console.log('\n🎉 ALL BROWSER TESTS COMPLETED SUCCESSFULLY! (100% PASS)');
    console.log(`✨ Total Tests Passed: ${results.filter(r => r.status === 'PASS').length}`);
    console.log(`🖼️ Total Screenshots Captured: 14 in frontend/screenshots/`);
  } catch (err) {
    console.error('\n❌ BROWSER TEST RUN FAILED:', err.message);
    await page.screenshot({ path: path.join(screenshotsDir, 'error_state.png') });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runBrowserTests();
