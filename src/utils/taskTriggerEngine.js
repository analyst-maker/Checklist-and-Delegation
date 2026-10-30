import { supabase } from '../lib/supabaseClient.js';

// Concurrency mutex to prevent parallel overlapping task generation triggers
let isTriggerExecuting = false;

/**
 * Parses DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, or YYYY/MM/DD strings into a Date object (midnight local)
 */
export function parseDateString(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
  
  const str = String(dateStr).trim();
  if (!str) return null;
  
  // Handle slashes: DD/MM/YYYY or YYYY/MM/DD
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY/MM/DD
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        return new Date(y, m, d);
      } else {
        // DD/MM/YYYY
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        return new Date(y, m, d);
      }
    }
  }
  
  // Handle dashes: YYYY-MM-DD or DD-MM-YYYY (including ISO datetime)
  if (str.includes('-')) {
    const datePart = str.split('T')[0].trim();
    const parts = datePart.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        return new Date(y, m, d);
      } else {
        // DD-MM-YYYY
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        return new Date(y, m, d);
      }
    }
  }
  
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  return null;
}

/**
 * Formats a Date object or date string to DD/MM/YYYY
 */
export function formatDateToDDMMYYYY(date) {
  if (!date) return '';
  let dObj = date;
  if (typeof date === 'string') {
    const parsed = parseDateString(date);
    if (parsed) dObj = parsed;
    else return date;
  }
  const d = String(dObj.getDate()).padStart(2, '0');
  const m = String(dObj.getMonth() + 1).padStart(2, '0');
  const y = dObj.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Reliably computes the next numeric Task ID for any Supabase table (Unique, Checklist, Delegation)
 */
export async function getNextTaskId(tableName) {
  try {
    // 1. Try ordering by quoted column '"Task ID"'
    const { data: orderedData, error: orderErr } = await supabase
      .from(tableName)
      .select('"Task ID"')
      .order('"Task ID"', { ascending: false })
      .limit(20);

    if (!orderErr && orderedData && orderedData.length > 0) {
      const maxId = orderedData.reduce((max, r) => {
        const raw = r['Task ID'] ?? r.id ?? 0;
        const num = parseInt(String(raw).replace(/\D/g, ''), 10);
        return !isNaN(num) && num > max ? num : max;
      }, 0);
      if (maxId > 0) return maxId + 1;
    }

    // 2. Fallback to scanning all Task IDs
    const { data: allRows } = await supabase
      .from(tableName)
      .select('"Task ID"');

    if (allRows && allRows.length > 0) {
      const maxId = allRows.reduce((max, r) => {
        const raw = r['Task ID'] ?? r.id ?? 0;
        const num = parseInt(String(raw).replace(/\D/g, ''), 10);
        return !isNaN(num) && num > max ? num : max;
      }, 0);
      if (maxId > 0) return maxId + 1;
    }

    return 1;
  } catch (err) {
    console.error(`Error calculating next Task ID for ${tableName}:`, err);
    return Math.floor(Date.now() / 1000);
  }
}

/**
 * Checks if two dates have the same Day, Month, and Year
 */
export function isSameDay(d1, d2) {
  if (!d1 || !d2) return false;
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
}

/**
 * Evaluates whether a Unique template is due to generate a task on targetDate
 */
export function isTemplateDue(template, targetDate = new Date()) {
  const freq = (template.Frequency || template.Freq || 'daily').toLowerCase().trim();
  const lastDateStr = template['Last Date'] || template.lastGeneratedDate;
  const startDateStr = template['Task Start date'] || template['Task Start Date'];

  const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  
  if (startDateStr) {
    const startDate = parseDateString(startDateStr);
    if (startDate && target < startDate) {
      return { isDue: false, reason: `Start date is in future (${startDateStr})` };
    }
  }

  if (!lastDateStr || String(lastDateStr).trim() === '') {
    return { isDue: true, reason: 'Never generated before' };
  }

  const lastDate = parseDateString(lastDateStr);
  if (!lastDate) {
    return { isDue: true, reason: 'Invalid last date, generation required' };
  }

  // If already generated on target date (today)
  if (isSameDay(target, lastDate)) {
    return { isDue: false, reason: `Already generated for today (${lastDateStr})` };
  }

  // If target is before last generated date
  if (target < lastDate) {
    return { isDue: false, reason: `Last generated date (${lastDateStr}) is after target date` };
  }

  switch (freq) {
    case 'daily': {
      return { isDue: true, reason: 'Daily task due today' };
    }
    case 'weekly': {
      const diffTime = target.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 7) {
        return { isDue: true, reason: `Weekly task due (${diffDays} days since last: ${lastDateStr})` };
      }
      return { isDue: false, reason: `Weekly task not due yet (${diffDays}/7 days passed)` };
    }
    case 'fortnightly':
    case 'fortnight': {
      const diffTime = target.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 14) {
        return { isDue: true, reason: `Fortnightly task due (${diffDays} days since last: ${lastDateStr})` };
      }
      return { isDue: false, reason: `Fortnightly task not due yet (${diffDays}/14 days passed)` };
    }
    case 'monthly': {
      // Check if 1 or more months have elapsed
      const monthsDiff = (target.getFullYear() - lastDate.getFullYear()) * 12 + (target.getMonth() - lastDate.getMonth());
      if (monthsDiff > 1 || (monthsDiff === 1 && target.getDate() >= lastDate.getDate())) {
        return { isDue: true, reason: `Monthly task due (${monthsDiff} month(s) passed)` };
      }
      return { isDue: false, reason: `Monthly task not due yet` };
    }
    case 'quarterly':
    case 'quarter': {
      const monthsDiff = (target.getFullYear() - lastDate.getFullYear()) * 12 + (target.getMonth() - lastDate.getMonth());
      if (monthsDiff > 3 || (monthsDiff >= 3 && target.getDate() >= lastDate.getDate())) {
        return { isDue: true, reason: `Quarterly task due (${monthsDiff} month(s) passed)` };
      }
      return { isDue: false, reason: `Quarterly task not due yet (${monthsDiff}/3 months)` };
    }
    case 'half-yearly':
    case 'halfyearly':
    case 'half yearly':
    case 'semi-annually': {
      const monthsDiff = (target.getFullYear() - lastDate.getFullYear()) * 12 + (target.getMonth() - lastDate.getMonth());
      if (monthsDiff > 6 || (monthsDiff >= 6 && target.getDate() >= lastDate.getDate())) {
        return { isDue: true, reason: `Half-yearly task due (${monthsDiff} month(s) passed)` };
      }
      return { isDue: false, reason: `Half-yearly task not due yet (${monthsDiff}/6 months)` };
    }
    case 'yearly': {
      const monthsDiff = (target.getFullYear() - lastDate.getFullYear()) * 12 + (target.getMonth() - lastDate.getMonth());
      if (monthsDiff > 12 || (monthsDiff >= 12 && target.getDate() >= lastDate.getDate())) {
        return { isDue: true, reason: `Yearly task due (${monthsDiff} month(s) passed)` };
      }
      return { isDue: false, reason: `Yearly task not due yet (${monthsDiff}/12 months)` };
    }
    case 'end-of-1st-week': {
      const isSameMonth = target.getFullYear() === lastDate.getFullYear() && target.getMonth() === lastDate.getMonth();
      if (target.getDate() >= 7 && (!isSameMonth || lastDate.getDate() < 7)) {
        return { isDue: true, reason: 'End of 1st Week due (7th of month)' };
      }
      return { isDue: false, reason: 'End of 1st Week not due' };
    }
    case 'end-of-2nd-week': {
      const isSameMonth = target.getFullYear() === lastDate.getFullYear() && target.getMonth() === lastDate.getMonth();
      if (target.getDate() >= 14 && (!isSameMonth || lastDate.getDate() < 14)) {
        return { isDue: true, reason: 'End of 2nd Week due (14th of month)' };
      }
      return { isDue: false, reason: 'End of 2nd Week not due' };
    }
    case 'end-of-3rd-week': {
      const isSameMonth = target.getFullYear() === lastDate.getFullYear() && target.getMonth() === lastDate.getMonth();
      if (target.getDate() >= 21 && (!isSameMonth || lastDate.getDate() < 21)) {
        return { isDue: true, reason: 'End of 3rd Week due (21st of month)' };
      }
      return { isDue: false, reason: 'End of 3rd Week not due' };
    }
    case 'end-of-4th-week': {
      const isSameMonth = target.getFullYear() === lastDate.getFullYear() && target.getMonth() === lastDate.getMonth();
      if (target.getDate() >= 28 && (!isSameMonth || lastDate.getDate() < 28)) {
        return { isDue: true, reason: 'End of 4th Week due (28th of month)' };
      }
      return { isDue: false, reason: 'End of 4th Week not due' };
    }
    case 'end-of-last-week': {
      const lastDayOfMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      const isSameMonth = target.getFullYear() === lastDate.getFullYear() && target.getMonth() === lastDate.getMonth();
      if (target.getDate() >= (lastDayOfMonth - 2) && (!isSameMonth || lastDate.getDate() < (lastDayOfMonth - 2))) {
        return { isDue: true, reason: 'End of Last Week due (Month end)' };
      }
      return { isDue: false, reason: 'End of Last Week not due' };
    }
    case 'one-time':
    case 'critical':
    case 'urgent': {
      // One-time tasks never repeat once generated
      return { isDue: false, reason: 'One-time task already generated once' };
    }
    default: {
      // Never generate daily for unhandled/custom frequency
      return { isDue: false, reason: `Frequency '${freq}' is not scheduled for daily generation` };
    }
  }
}

/**
 * Fast batch updater for template Last Dates in Supabase 'Unique' table
 * Uses parallel promises in chunks so updating 400+ templates completes in ~1s
 */
export async function updateUniqueTemplatesLastDateBatch(updates = []) {
  if (!updates || updates.length === 0) return { updatedCount: 0, errors: [] };

  const CONCURRENCY = 20;
  let updatedCount = 0;
  const errors = [];

  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    const chunk = updates.slice(i, i + CONCURRENCY);
    const promises = chunk.map(async (item) => {
      try {
        const dateVal = item.newLastDate;
        let res = null;

        // Try matching by Task ID
        if (item.id !== undefined && item.id !== null) {
          res = await supabase
            .from('Unique')
            .update({ 'Last Date': dateVal })
            .eq('Task ID', item.id);
        }

        // Fallback matching by primary key 'id'
        if ((!res || res.error || res.count === 0) && item.dbId !== undefined && item.dbId !== null) {
          res = await supabase
            .from('Unique')
            .update({ 'Last Date': dateVal })
            .eq('id', item.dbId);
        }

        if (res && res.error) {
          errors.push({ id: item.id, error: res.error.message });
        } else {
          updatedCount++;
        }
      } catch (err) {
        errors.push({ id: item.id, error: err.message || err });
      }
    });

    await Promise.all(promises);
  }

  return { updatedCount, errors };
}

/**
 * Main Task Generator Trigger function with duplicate prevention
 */
export async function runTaskGenerationTrigger(options = {}) {
  const {
    targetDate = new Date(),
    ignoreCalendarCheck = false,
    specificTemplateId = null,
    forceRunSpecific = false,
    onProgress = () => {}
  } = options;

  if (isTriggerExecuting) {
    console.warn('Task generation trigger is already executing. Ignoring concurrent call.');
    return {
      success: true,
      skipped: true,
      reason: 'Task generation is already running',
      tasksGenerated: 0,
      generatedTasks: [],
      logs: [{ time: new Date().toLocaleTimeString(), message: 'Trigger already running in background', type: 'info' }]
    };
  }

  isTriggerExecuting = true;

  const targetDateObj = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const todayDDMMYYYY = formatDateToDDMMYYYY(targetDateObj);
  const nowTimestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const logs = [];
  const addLog = (msg, type = 'info') => {
    const entry = { time: new Date().toLocaleTimeString(), message: msg, type };
    logs.push(entry);
    onProgress(entry, logs);
  };

  addLog(`Starting task generation process for date: ${todayDDMMYYYY}...`);

  try {
    // 1. Check Working Day Calendar & Holiday List if not explicitly ignored
    let isWorkingDay = true;
    let holidayInfo = null;
    let nonWorkingReason = null;

    if (!ignoreCalendarCheck) {
      // 0. Hard Sunday Check
      if (targetDateObj.getDay() === 0) {
        addLog(`Target date ${todayDDMMYYYY} is Sunday (Non-working day). Task generation skipped.`, 'warning');
        return {
          success: true,
          skipped: true,
          reason: `Target date ${todayDDMMYYYY} is Sunday (Non-working day)`,
          tasksGenerated: 0,
          generatedTasks: [],
          logs
        };
      }

      addLog(`Checking working day calendar and holiday schedule for ${todayDDMMYYYY}...`);
      
      const d = targetDateObj.getDate();
      const m = targetDateObj.getMonth() + 1;
      const y = targetDateObj.getFullYear();
      const dateVariants = [
        todayDDMMYYYY,
        `${d}/${m}/${y}`,
        `${String(d).padStart(2, '0')}/${m}/${y}`,
        `${d}/${String(m).padStart(2, '0')}/${y}`
      ];
      const uniqueVariants = Array.from(new Set(dateVariants));

      const [holRes, calRes] = await Promise.all([
        supabase.from('Holiday List').select('*').limit(500),
        supabase.from('Working Day Calendar').select('*').in('Date', uniqueVariants)
      ]);

      if (holRes.data && holRes.data.length > 0) {
        const foundHoliday = holRes.data.find(h => {
          const rawDate = String(h.Date || '').trim();
          if (uniqueVariants.includes(rawDate)) return true;
          const hDate = parseDateString(rawDate);
          return hDate && isSameDay(hDate, targetDateObj);
        });

        if (foundHoliday) {
          isWorkingDay = false;
          holidayInfo = foundHoliday.Holiday || 'Holiday';
          nonWorkingReason = `Holiday: ${holidayInfo}`;
          addLog(`Target date ${todayDDMMYYYY} is a holiday: "${holidayInfo}"`, 'warning');
        }
      }

      if (isWorkingDay) {
        const foundInCalendar = calRes.data && calRes.data.length > 0;
        if (!foundInCalendar) {
          isWorkingDay = false;
          const isSunday = targetDateObj.getDay() === 0;
          nonWorkingReason = isSunday 
            ? `Target date ${todayDDMMYYYY} is Sunday (Non-working day)`
            : `Target date ${todayDDMMYYYY} is not in Working Day Calendar`;
          addLog(`${nonWorkingReason}`, 'warning');
        }
      }

      if (!isWorkingDay) {
        addLog(`Task generation skipped because ${todayDDMMYYYY} is not a working day. (Toggle 'Ignore Holiday / Calendar Check' to force generate).`, 'warning');
        return {
          success: true,
          skipped: true,
          reason: nonWorkingReason || (holidayInfo ? `Holiday: ${holidayInfo}` : 'Non-working day'),
          tasksGenerated: 0,
          generatedTasks: [],
          logs
        };
      }
    }

    // 2. Fetch Unique Templates
    addLog(`Fetching recurring task templates from 'Unique' table...`);
    let templates = [];

    if (specificTemplateId) {
      // First try direct query
      const { data: specificTemplates, error: specificErr } = await supabase
        .from('Unique')
        .select('*')
        .eq('Task ID', specificTemplateId);

      if (!specificErr && specificTemplates && specificTemplates.length > 0) {
        templates = specificTemplates;
      } else {
        // Fallback to searching all templates in case Task ID is string/number mismatch
        const { data: allT } = await supabase.from('Unique').select('*').limit(3000);
        if (allT) {
          templates = allT.filter(t => String(t['Task ID'] ?? t.id ?? '').trim() === String(specificTemplateId).trim());
        }
      }
    } else {
      const { data: allTemplates, error: templateError } = await supabase.from('Unique').select('*').limit(3000);
      if (templateError) throw templateError;
      templates = allTemplates || [];
    }

    if (!templates || templates.length === 0) {
      addLog(`No matching templates found in 'Unique' table to process.`, 'warning');
      return { success: true, tasksGenerated: 0, generatedTasks: [], logs };
    }

    addLog(`Found ${templates.length} template(s). Evaluating eligibility for ${todayDDMMYYYY}...`);

    // 3. Fetch existing Checklist tasks to ensure 100% duplicate prevention
    const { data: existingChecklistRows, error: cErr } = await supabase
      .from('Checklist')
      .select('"Task ID", "Name", "Tast Descriptions", "Task Start Date"')
      .order('Task ID', { ascending: false })
      .limit(4000);

    if (cErr) {
      console.warn('Could not fetch existing Checklist rows for deduplication:', cErr);
    }

    const makeTaskKey = (name, desc, dateVal) => {
      const normName = (name || '').toString().trim().toLowerCase();
      const normDesc = (desc || '').toString().trim().toLowerCase();
      const parsed = parseDateString(dateVal);
      const normDate = parsed ? formatDateToDDMMYYYY(parsed) : (dateVal || '').toString().trim();
      return `${normName}:::${normDesc}:::${normDate}`;
    };

    const existingTaskKeys = new Set();
    if (existingChecklistRows && existingChecklistRows.length > 0) {
      for (const row of existingChecklistRows) {
        const d = row['Tast Descriptions'] || row['Task Description'] || '';
        const n = row['Name'] || '';
        const dt = row['Task Start Date'] || '';
        if (n && d && dt) {
          existingTaskKeys.add(makeTaskKey(n, d, dt));
        }
      }
    }

    const seenInThisRun = new Set();

    // 4. Determine highest existing Task ID in Checklist table
    let nextTaskId = await getNextTaskId('Checklist');

    const tasksToInsert = [];
    const templateUpdates = [];
    const generatedTasksSummary = [];

    for (const template of templates) {
      const evalResult = isTemplateDue(template, targetDateObj);
      const department = template.Department || '';
      const name = template.Name || '';
      const taskDesc = template['Task Description'] || template['Tast Descriptions'] || '';
      const freq = template.Frequency || template.Freq || 'daily';
      const givenBy = template['Give By'] || template['Given By'] || 'Admin';
      const reminder = template['Enable Reminder'] || template['Enable Reminders'] || 'Yes';
      const attachment = template['Require Attatchment'] || template['Require Attachment'] || 'No';

      const taskKey = makeTaskKey(name, taskDesc, todayDDMMYYYY);

      // Single template run requested manually
      const isTargetTemplate = specificTemplateId ? String(template['Task ID']) === String(specificTemplateId) : true;
      if (!isTargetTemplate) continue;

      // Check duplicate
      const alreadyExistsInChecklist = existingTaskKeys.has(taskKey) || seenInThisRun.has(taskKey);

      if (alreadyExistsInChecklist) {
        addLog(`Template #${template['Task ID']} (${name}) already exists in Checklist for ${todayDDMMYYYY}. Skipped.`, 'warning');
        templateUpdates.push({
          id: template['Task ID'],
          dbId: template.id,
          newLastDate: todayDDMMYYYY
        });
        continue;
      }

      if (evalResult.isDue || forceRunSpecific) {
        seenInThisRun.add(taskKey);
        const taskId = nextTaskId++;

        const newTask = {
          'Task ID': taskId,
          'Timestamp': nowTimestamp,
          'Department': department,
          'Given By': givenBy,
          'Name': name,
          'Tast Descriptions': taskDesc,
          'Task Start Date': todayDDMMYYYY,
          'Freq': freq,
          'Enable Reminders': reminder,
          'Require Attachment': attachment,
          'Actual': null,
          'Delay': null,
          'Status': null,
          'Remarks': null,
          'Uploaded Image': null
        };

        tasksToInsert.push(newTask);
        templateUpdates.push({
          id: template['Task ID'],
          dbId: template.id,
          newLastDate: todayDDMMYYYY
        });

        generatedTasksSummary.push({
          taskId,
          templateId: template['Task ID'],
          department,
          name,
          taskDesc,
          freq,
          date: todayDDMMYYYY
        });
      } else {
        addLog(`Template #${template['Task ID']} (${name}) skipped: ${evalResult.reason}`, 'warning');
      }
    }

    if (tasksToInsert.length === 0) {
      addLog(`All evaluated templates are already generated and up-to-date for ${todayDDMMYYYY}. 0 new tasks needed.`, 'info');
      
      // Update template Last Dates if any were out of sync
      if (templateUpdates.length > 0) {
        addLog(`Syncing 'Last Date' on ${templateUpdates.length} existing templates to ${todayDDMMYYYY}...`);
        const { updatedCount } = await updateUniqueTemplatesLastDateBatch(templateUpdates);
        addLog(`✅ Successfully synced ${updatedCount} template Last Dates to ${todayDDMMYYYY}.`, 'success');
      }

      return {
        success: true,
        tasksGenerated: 0,
        generatedTasks: [],
        updatedTemplatesCount: templateUpdates.length,
        totalEvaluated: templates.length,
        logs
      };
    }

    addLog(`Inserting ${tasksToInsert.length} new generated task(s) into 'Checklist' table...`);

    // 5. Batch Insert into Checklist table
    const BATCH_SIZE = 50;
    for (let i = 0; i < tasksToInsert.length; i += BATCH_SIZE) {
      const batch = tasksToInsert.slice(i, i + BATCH_SIZE);
      const { error: insertErr } = await supabase.from('Checklist').insert(batch);
      if (insertErr) throw insertErr;
    }

    // 6. Fast Parallel Batch Update Last Date in 'Unique' table
    addLog(`Updating 'Last Date' to ${todayDDMMYYYY} on ${templateUpdates.length} template(s) in 'Unique' table...`);
    const { updatedCount, errors: updateErrors } = await updateUniqueTemplatesLastDateBatch(templateUpdates);
    
    if (updateErrors.length > 0) {
      console.warn(`Template Last Date update notices:`, updateErrors);
    }

    // 7. Save trigger log in localStorage for display
    try {
      const historyItem = {
        timestamp: new Date().toISOString(),
        date: todayDDMMYYYY,
        count: tasksToInsert.length,
        tasks: generatedTasksSummary
      };
      const existingHistory = JSON.parse(localStorage.getItem('task_trigger_history') || '[]');
      existingHistory.unshift(historyItem);
      localStorage.setItem('task_trigger_history', JSON.stringify(existingHistory.slice(0, 30)));
    } catch (e) {
      console.warn('Failed to save trigger history to localStorage:', e);
    }

    addLog(`✅ Successfully generated ${tasksToInsert.length} task(s) and updated 'Last Date' to ${todayDDMMYYYY} for date ${todayDDMMYYYY}!`, 'success');

    return {
      success: true,
      tasksGenerated: tasksToInsert.length,
      generatedTasks: generatedTasksSummary,
      updatedTemplatesCount: updatedCount,
      totalEvaluated: templates.length,
      logs
    };
  } catch (error) {
    console.error('Error during task generation trigger:', error);
    addLog(`❌ Error running task trigger: ${error.message || error}`, 'error');
    return {
      success: false,
      error: error.message || error.toString(),
      tasksGenerated: 0,
      generatedTasks: [],
      logs
    };
  } finally {
    isTriggerExecuting = false;
  }
}
