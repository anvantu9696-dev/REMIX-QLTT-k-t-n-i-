import { resolveDeviceRelations } from '../utils/relationValidator';

async function testSingle() {
    const subCode = '110_VH'; 
    const feederCode = '475-VH'; 
    
    console.log(`Testing substation: ${subCode}, feeder: ${feederCode}`);
    
    const relation = await resolveDeviceRelations(subCode, feederCode);
    console.log('Result:', relation);
}

testSingle().catch(console.error);
