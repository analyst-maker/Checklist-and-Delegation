// Add holidays using the project's Supabase client
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vbfopxowzfvtzqpqdbgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiZm9weG93emZ2dHpxcHFkYmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTQ0Njk2OTAsImV4cCI6MjAwMTY0NTY5MH0.4GYYdwm9J-TI1p7X7V5P_rEZ5k7l9pMkR5PqN9X5t7g';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const holidays = [
  { Date: '01/01/2026', Day: 'Thursday', Holiday: 'New Year' },
  { Date: '26/01/2026', Day: 'Monday', Holiday: 'Republic Day' },
  { Date: '04/03/2026', Day: 'Wednesday', Holiday: 'Holi' },
  { Date: '05/03/2026', Day: 'Thursday', Holiday: 'Post Holi' },
  { Date: '15/08/2026', Day: 'Saturday', Holiday: 'Independence Day' },
  { Date: '28/08/2026', Day: 'Friday', Holiday: 'Rakshabandhan' },
  { Date: '02/10/2026', Day: 'Friday', Holiday: 'Gandhi Jayanti' },
  { Date: '20/10/2026', Day: 'Tuesday', Holiday: 'Dussehra' },
  { Date: '08/11/2026', Day: 'Sunday', Holiday: 'Diwali' },
  { Date: '09/11/2026', Day: 'Monday', Holiday: 'Post Diwali' },
  { Date: '10/11/2026', Day: 'Tuesday', Holiday: 'Post Diwali' }
];

async function seedHolidays() {
  try {
    console.log('🎯 Adding ' + holidays.length + ' holidays to Supabase...\n');

    // Delete existing records first
    const { error: deleteError } = await supabase
      .from('Holiday List')
      .delete()
      .gt('id', 0);

    if (deleteError) {
      console.warn('⚠️ Warning: Could not clear existing records:', deleteError.message);
    } else {
      console.log('✅ Cleared existing records\n');
    }

    // Insert new holidays
    const { data, error } = await supabase
      .from('Holiday List')
      .insert(holidays);

    if (error) {
      console.error('❌ Error adding holidays:', error.message);
      console.error('Details:', error);
      process.exit(1);
    }

    console.log('✅ Successfully added ' + holidays.length + ' holidays!\n');
    console.log('📅 Holidays added:');
    holidays.forEach((h, i) => {
      console.log(`${i + 1}. ${h.Holiday} - ${h.Date} (${h.Day})`);
    });

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

seedHolidays();
