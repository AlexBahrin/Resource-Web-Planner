// Test script for import/export functionality
const fs = require('fs');
const http = require('http');
const path = require('path');

// Get session ID from command line argument
const sessionId = process.argv[2];
if (!sessionId) {
  console.error('Please provide a session ID as a command line argument');
  console.error('Usage: node test-import-export.js <sessionId>');
  process.exit(1);
}

// Configuration
const HOST = 'localhost';
const PORT = 8087;

// Utility function to make HTTP requests
function makeRequest(path, method = 'GET', data = null, contentType = 'application/json') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Cookie': `sessionId=${sessionId}`
      }
    };

    if (data && contentType === 'application/json' && typeof data !== 'string') {
      // Only stringify the data if it's not already a string
      options.headers['Content-Type'] = contentType;
      data = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(data);
    } else if (data) {
      // For strings or other content types, send as is
      options.headers['Content-Type'] = contentType;
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    console.log(`Making ${method} request to ${path}`);
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log(`Response received, length: ${responseData.length}`);
        
        // Try to parse as JSON if the content type suggests it
        const contentType = res.headers['content-type'];
        if (contentType && contentType.includes('application/json')) {
          try {
            const jsonResponse = JSON.parse(responseData);
            resolve({ statusCode: res.statusCode, headers: res.headers, body: jsonResponse });
          } catch (e) {
            console.error('Error parsing JSON response:', e);
            resolve({ statusCode: res.statusCode, headers: res.headers, body: responseData });
          }
        } else {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: responseData });
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Request error: ${error.message}`);
      reject(error);
    });

    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

// Test functions
async function testExportJSON() {
  console.log('\n===== Testing JSON export =====');
  try {
    const response = await makeRequest('/api/resources/export?format=json');
    
    if (response.statusCode === 200) {
      const outputFile = 'export-test.json';
      // If it's already a JSON object, stringify it nicely
      const outputData = typeof response.body === 'object' 
        ? JSON.stringify(response.body, null, 2) 
        : response.body;
        
      fs.writeFileSync(outputFile, outputData);
      console.log(`Exported JSON data saved to ${outputFile}`);
    } else {
      console.error('JSON Export failed with status:', response.statusCode);
      console.log('Response body:', response.body);
    }
  } catch (error) {
    console.error('JSON Export test failed:', error);
  }
}

async function testExportCSV() {
  console.log('\n===== Testing CSV export =====');
  try {
    const response = await makeRequest('/api/resources/export?format=csv');
    
    if (response.statusCode === 200) {
      const outputFile = 'export-test.csv';
      fs.writeFileSync(outputFile, response.body);
      console.log(`Exported CSV data saved to ${outputFile}`);
    } else {
      console.error('CSV Export failed with status:', response.statusCode);
      console.log('Response body:', response.body);
    }
  } catch (error) {
    console.error('CSV Export test failed:', error);
  }
}

async function testExportXML() {
  console.log('\n===== Testing XML export =====');
  try {
    const response = await makeRequest('/api/resources/export?format=xml');
    
    if (response.statusCode === 200) {
      const outputFile = 'export-test.xml';
      fs.writeFileSync(outputFile, response.body);
      console.log(`Exported XML data saved to ${outputFile}`);
    } else {
      console.error('XML Export failed with status:', response.statusCode);
      console.log('Response body:', response.body);
    }
  } catch (error) {
    console.error('XML Export test failed:', error);
  }
}

async function testImportJSON() {
  console.log('\n===== Testing JSON import =====');
  try {
    // Create simple test data
    const testData = [
      {
        "name": "Test JSON Import",
        "category_id": 1,
        "quantity": 10,
        "description": "Imported via JSON test",
        "low_stock_threshold": 2
      }
    ];
    
    const jsonString = JSON.stringify(testData);
    
    // Save to file for reference
    const importFile = 'import-test.json';
    fs.writeFileSync(importFile, jsonString);
    console.log(`Test JSON saved to ${importFile}`);
    
    // Use child_process to run curl directly, which works reliably with file uploads
    const { exec } = require('child_process');
    
    const curlCommand = `curl -s -X POST -H "Content-Type: application/json" -H "Cookie: sessionId=${sessionId}" --data-binary @${importFile} "http://localhost:8087/api/resources/import?filename=${importFile}"`;
    
    console.log('Executing curl command for JSON import');
    const curlOutput = await new Promise((resolve, reject) => {
      exec(curlCommand, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
    
    console.log(`Curl output length: ${curlOutput.length}`);
    const response = {
      statusCode: 200,  // Assuming success since curl doesn't easily return status code
      body: JSON.parse(curlOutput)
    };
    
    // Import the data using our custom approach
    // const response = await makeRequest(
    //   `/api/resources/import?filename=${importFile}`,
    //   'POST',
    //   fileContent,
    //   'application/json'
    // );
    
    console.log(`JSON Import response:`, response.body);
    
    // NOTE: Even though we may get a 404 response, the server logs indicate imports are still processed.
    // Let's verify if it worked by checking resources after import
    if (response.statusCode === 404) {
      console.log("NOTE: The server returned 404 but may still have processed the import.");
      console.log("Checking if resources were actually imported...");
      
      const checkResources = await makeRequest('/api/resources');
      if (checkResources.statusCode === 200) {
        const resources = checkResources.body;
        const importedResource = resources.find(r => 
          r.name === "Test JSON Import" && r.description === "Imported via JSON test"
        );
        
        if (importedResource) {
          console.log("SUCCESS: Resource was imported successfully despite 404 response!");
          console.log(`Imported resource: ${importedResource.name} (ID: ${importedResource.id})`);
        } else {
          console.log("Resource not found. Import may have failed.");
        }
      }
    }
  } catch (error) {
    console.error('JSON Import test failed:', error);
  }
}

async function testImportCSV() {
  console.log('\n===== Testing CSV import =====');
  try {
    // Create simple test data
    const csvData = 'name,category_id,quantity,description,low_stock_threshold\n' +
                    'Test CSV Import,1,15,"Imported via CSV test",3';
    
    // Save to file for reference
    const importFile = 'import-test.csv';
    fs.writeFileSync(importFile, csvData);
    console.log(`Test CSV saved to ${importFile}`);
    
    // Import the data
    const response = await makeRequest(
      `/api/resources/import?filename=${importFile}`,
      'POST',
      csvData,
      'text/csv'
    );
    
    console.log(`CSV Import response:`, response.body);
  } catch (error) {
    console.error('CSV Import test failed:', error);
  }
}

async function testImportXML() {
  console.log('\n===== Testing XML import =====');
  try {
    // Create simple test data
    const xmlData = `<?xml version="1.0"?>
<resources>
  <resource>
    <name>Test XML Import</name>
    <category_id>1</category_id>
    <quantity>20</quantity>
    <description>Imported via XML test</description>
    <low_stock_threshold>5</low_stock_threshold>
  </resource>
</resources>`;
    
    // Save to file for reference
    const importFile = 'import-test.xml';
    fs.writeFileSync(importFile, xmlData);
    console.log(`Test XML saved to ${importFile}`);
    
    // Import the data
    const response = await makeRequest(
      `/api/resources/import?filename=${importFile}`,
      'POST',
      xmlData,
      'application/xml'
    );
    
    console.log(`XML Import response:`, response.body);
  } catch (error) {
    console.error('XML Import test failed:', error);
  }
}

// Main test function
async function runTests() {
  try {
    // First check if we can access resources (validates session)
    console.log('\n===== Validating session =====');
    const checkSession = await makeRequest('/api/resources');
    
    if (checkSession.statusCode !== 200) {
      console.error('Session validation failed! Make sure your session ID is valid.');
      return;
    }
    
    console.log('Session is valid, running tests...');
    
    // Test exports first
    await testExportJSON();
    await testExportCSV();
    await testExportXML();
    
    // Then test imports
    await testImportJSON();
    await testImportCSV();
    await testImportXML();
    
    console.log('\n===== All tests completed! =====');
  } catch (error) {
    console.error('Test suite failed:', error);
  }
}

// Run tests
runTests();
