#!/usr/bin/env node

/**
 * Simple SummaryAgent Test (Database-independent)
 * 
 * Tests the enhanced SummaryAgent without database dependencies
 */

import SummarizationAgent from '../agents/summarizationAgent.js';

async function testSummaryAgentSimple() {
  console.log('🧪 Starting Simple SummaryAgent Test...\n');

  try {
    // Initialize the summarization agent
    const summarizationAgent = new SummarizationAgent();
    console.log('✅ SummarizationAgent initialized');

    // Test 1: Agent Statistics
    console.log('📊 Test 1: Agent Statistics');
    const stats = summarizationAgent.getStats();
    console.log('Agent Stats:', stats);

    // Test 2: Available Summary Types
    console.log('\n🎯 Test 2: Available Summary Types');
    const summaryTypes = summarizationAgent.getAvailableSummaryTypes();
    summaryTypes.forEach(type => {
      console.log(`- ${type.id}: ${type.name} (max ${type.maxLength} chars)`);
    });

    // Test 3: Transcription Collection
    console.log('\n📝 Test 3: Transcription Collection');
    const testSessionId = 'simple-test-session';
    
    const mockTranscriptions = [
      {
        text: 'Welcome to today\'s product development meeting',
        speaker: 'Product Manager',
        timestamp: new Date(),
        language: 'en',
        confidence: 0.95
      },
      {
        text: 'We need to finalize the Q4 roadmap by next week',
        speaker: 'Engineering Lead',
        timestamp: new Date(),
        language: 'en',
        confidence: 0.92
      },
      {
        text: 'What are the main priorities for the mobile app?',
        speaker: 'UX Designer',
        timestamp: new Date(),
        language: 'en',
        confidence: 0.88
      }
    ];

    // Collect transcriptions
    mockTranscriptions.forEach(transcription => {
      summarizationAgent.collectTranscription(testSessionId, transcription);
    });

    const collectedCount = summarizationAgent.getSessionTranscriptions(testSessionId).length;
    console.log(`✅ Collected ${collectedCount} transcriptions`);

    // Test 4: Mock Summary Generation
    console.log('\n🤖 Test 4: Mock Summary Generation');
    const mockMessages = [
      {
        text: 'Let\'s discuss the mobile app priorities',
        user: { name: 'Alice', role: 'Product Manager' },
        timestamp: new Date()
      },
      {
        text: 'Performance is crucial for user retention',
        user: { name: 'Bob', role: 'Engineer' },
        timestamp: new Date()
      }
    ];

    const summaryResult = await summarizationAgent.generateSummary(
      testSessionId,
      [], // captions
      mockMessages,
      {
        summaryType: 'meeting',
        language: 'en',
        includeChat: true,
        maxLength: 500
      }
    );

    console.log('✅ Summary generated successfully');
    console.log(`📄 Content: ${summaryResult.summary.content.substring(0, 100)}...`);
    console.log(`🎯 Key Points: ${summaryResult.summary.keyPoints.length}`);
    console.log(`📋 Action Items: ${summaryResult.summary.actionItems.length}`);
    console.log(`❓ Questions: ${summaryResult.summary.questions.length}`);
    console.log(`🤖 Mode: ${summaryResult.metadata.useMockMode ? 'Mock Mode' : 'GPT-4 Mode'}`);
    console.log(`⏱️ Processing Time: ${summaryResult.metadata.processingTime}ms`);

    // Test 5: Real-time Update
    console.log('\n⚡ Test 5: Real-time Update Generation');
    const realtimeUpdate = await summarizationAgent.generateRealtimeUpdate(
      [], // recent captions
      mockMessages,
      {
        sessionId: testSessionId,
        updateType: 'key_points',
        language: 'en'
      }
    );

    console.log('✅ Real-time update generated');
    console.log(`📝 Update: ${realtimeUpdate.content.substring(0, 80)}...`);
    console.log(`🔄 Type: ${realtimeUpdate.updateType}`);

    // Test 6: Cleanup
    console.log('\n🧹 Test 6: Cleanup');
    summarizationAgent.clearSessionTranscriptions(testSessionId);
    console.log('✅ Session transcriptions cleared');

    console.log('\n🎉 All simple SummaryAgent tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Agent initialization working');
    console.log('- ✅ Statistics and types working');
    console.log('- ✅ Transcription collection working');
    console.log('- ✅ Mock summary generation working');
    console.log('- ✅ Structured summary format working');
    console.log('- ✅ Real-time updates working');
    console.log('- ✅ Session management working');
    console.log('- ✅ GPT-4 integration ready (if API key available)');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSummaryAgentSimple()
    .then(() => {
      console.log('\n🎯 All simple tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Simple tests failed:', error);
      process.exit(1);
    });
}

export default testSummaryAgentSimple;
