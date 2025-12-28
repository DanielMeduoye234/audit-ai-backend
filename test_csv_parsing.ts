
import fs from 'fs';
import path from 'path';
import documentService from './src/services/documentService';

async function testParsing() {
    const filePath = path.join(__dirname, '../sample_financial_data.csv');
    console.log(`Testing parsing for: ${filePath}`);

    try {
        const buffer = fs.readFileSync(filePath);
        const result = await documentService.parseDocument(buffer, 'sample_financial_data.csv');
        console.log('✅ Parsing Successful');
        console.log('Row Count:', result.rowCount);
        console.log('Headers:', result.headers);
        console.log('Summary:', result.summary);
    } catch (error) {
        console.error('❌ Parsing Failed:', error);
    }
}

testParsing();
