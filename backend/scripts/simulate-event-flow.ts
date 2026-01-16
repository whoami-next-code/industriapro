import { io } from 'socket.io-client';

const URL = 'http://localhost:3000'; // Adjust if backend runs on different port
const socket = io(URL, {
  transports: ['websocket'],
});

console.log('--- Event Flow Simulation ---');
console.log('Connecting to backend...');

socket.on('connect', () => {
  console.log('✅ Connected to Broker (Socket.IO)');
  
  // Simulate listening as Admin
  console.log('👀 Listening for "admin.approval_needed" events...');
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected');
});

socket.on('admin.approval_needed', (data) => {
  console.log('\n🔔 [ADMIN] New Notification Received:');
  console.log('------------------------------------------------');
  console.log(`Job (Cotizacion): #${data.quotationId}`);
  console.log(`Technician: ${data.technician}`);
  console.log(`Proposed Status: ${data.proposedStatus}`);
  console.log(`Message: ${data.message}`);
  console.log(`Timestamp: ${data.timestamp}`);
  console.log('------------------------------------------------\n');
  
  // Simulate Admin Review (just print what admin would do)
  console.log('🤖 Simulating Admin Action:');
  console.log('   -> Reviewing request...');
  console.log('   -> [DECISION] Approve or Reject? (Manual step in real app)');
});

socket.on('cotizaciones.updated', (data) => {
  console.log('ℹ️ [BROKER] Generic Update Event Broadcasted:', data.id);
});

// Keep script running
setInterval(() => {}, 1000);
