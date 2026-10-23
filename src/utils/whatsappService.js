import { supabase } from '../lib/supabaseClient';

export const DEFAULT_TEMPLATE = `🔔 *REMINDER: DELEGATION TASK*
Dear $(Name),

You have been assigned a new task. Please find the details below:

📌 Task ID: $(Task ID)
🧑💼 Allocated By: $(Given By)
📝 Task Description: $(Task Description)
⏳ Deadline: $(Task Start Date)

Please make sure the task is completed before the deadline. For any assistance, feel free to reach out.

Best regards,
Skyler World`;

export const DEFAULT_TASK_DONE_TEMPLATE = `✅ *TASK COMPLETED NOTIFICATION*
Dear $(Given By),

The delegation task assigned by you has been completed. Details below:

📌 Task ID: $(Task ID)
🧑💼 Completed By: $(Name)
📝 Task Description: $(Task Description)
📅 Completion Date: $(Completion Date)
💬 Remarks: $(Remarks)
📎 Attachment: $(Attachment)

You can review the task details in the Delegation portal.

Best regards,
Skyler World`;

const LOCAL_STORAGE_CONFIG_KEY = 'maytapi_whatsapp_config_v1';
const LOCAL_STORAGE_EXTENDED_KEY = 'whatsapp_sms_config_v2';
const LOCAL_STORAGE_LOGS_KEY = 'maytapi_whatsapp_logs_v1';

/**
 * Retrieve WhatsApp configuration (Supports both Maytapi and AiSensy providers)
 */
export const getWhatsappConfig = async () => {
  let localConfig = {
    provider: 'maytapi', // 'maytapi' | 'aisensy'
    // Maytapi credentials
    productId: '',
    phoneId: '',
    token: '',
    apiUrl: 'https://api.maytapi.com/api',
    // AiSensy credentials
    aisensyApiKey: '',
    aisensyCampaignName: '',
    aisensyDoneCampaignName: '',
    aisensyApiUrl: 'https://backend.aisensy.com/campaign/t1/api/v2',
    enabled: true,
    template: DEFAULT_TEMPLATE,
    templateTaskDone: DEFAULT_TASK_DONE_TEMPLATE,
  };

  // 1. Read from localStorage (v2 first, fallback to v1)
  try {
    const storedV2 = localStorage.getItem(LOCAL_STORAGE_EXTENDED_KEY);
    if (storedV2) {
      localConfig = { ...localConfig, ...JSON.parse(storedV2) };
    } else {
      const storedV1 = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
      if (storedV1) {
        localConfig = { ...localConfig, ...JSON.parse(storedV1) };
      }
    }
  } catch (e) {
    console.warn('Failed to parse local WhatsApp config:', e);
  }

  // 2. Try fetching from Supabase whatsapp_settings table
  try {
    const { data, error } = await supabase
      .from('whatsapp_settings')
      .select('*');

    if (!error && Array.isArray(data) && data.length > 0) {
      const defaultRow = data.find((r) => r.id === 'default');
      const maytapiRow = data.find((r) => r.id === 'maytapi');
      const aisensyRow = data.find((r) => r.id === 'aisensy');
      const taskDoneRow = data.find((r) => r.id === 'task_done');

      if (defaultRow) {
        const detectedProvider = (defaultRow.product_id === 'aisensy' || defaultRow.product_id === 'maytapi')
          ? defaultRow.product_id
          : localConfig.provider;

        localConfig.provider = detectedProvider || localConfig.provider;
        localConfig.enabled = defaultRow.enabled !== undefined ? Boolean(defaultRow.enabled) : localConfig.enabled;
        localConfig.template = defaultRow.template || localConfig.template;

        // Backward compatibility
        if (defaultRow.product_id && defaultRow.product_id !== 'aisensy' && defaultRow.product_id !== 'maytapi') {
          localConfig.productId = defaultRow.product_id || localConfig.productId;
          localConfig.phoneId = defaultRow.phone_id || localConfig.phoneId;
          localConfig.token = defaultRow.token || localConfig.token;
          localConfig.apiUrl = defaultRow.api_url || localConfig.apiUrl;
        }
      }

      if (maytapiRow) {
        localConfig.productId = maytapiRow.product_id || localConfig.productId;
        localConfig.phoneId = maytapiRow.phone_id || localConfig.phoneId;
        localConfig.token = maytapiRow.token || localConfig.token;
        localConfig.apiUrl = maytapiRow.api_url || localConfig.apiUrl;
      }

      if (aisensyRow) {
        localConfig.aisensyCampaignName = aisensyRow.product_id || localConfig.aisensyCampaignName;
        localConfig.aisensyApiKey = aisensyRow.token || localConfig.aisensyApiKey;
        localConfig.aisensyApiUrl = aisensyRow.api_url || localConfig.aisensyApiUrl;
      }

      if (taskDoneRow) {
        localConfig.templateTaskDone = taskDoneRow.template || localConfig.templateTaskDone;
        if (taskDoneRow.product_id) {
          localConfig.aisensyDoneCampaignName = taskDoneRow.product_id;
        }
      }

      // Keep localStorage in sync
      localStorage.setItem(LOCAL_STORAGE_EXTENDED_KEY, JSON.stringify(localConfig));
      localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(localConfig));
    }
  } catch (e) {
    // Continue with localConfig
  }

  return localConfig;
};

/**
 * Backward compatibility alias for getMaytapiConfig
 */
export const getMaytapiConfig = getWhatsappConfig;

/**
 * Save WhatsApp configuration (Supports saving both Maytapi and AiSensy settings)
 */
export const saveWhatsappConfig = async (config) => {
  const merged = {
    provider: (config.provider || 'maytapi').toLowerCase(), // 'maytapi' | 'aisensy'
    productId: (config.productId || '').trim(),
    phoneId: (config.phoneId || '').trim(),
    token: (config.token || '').trim(),
    apiUrl: (config.apiUrl || 'https://api.maytapi.com/api').trim(),
    aisensyApiKey: (config.aisensyApiKey || '').trim(),
    aisensyCampaignName: (config.aisensyCampaignName || '').trim(),
    aisensyDoneCampaignName: (config.aisensyDoneCampaignName || '').trim(),
    aisensyApiUrl: (config.aisensyApiUrl || 'https://backend.aisensy.com/campaign/t1/api/v2').trim(),
    enabled: Boolean(config.enabled),
    template: config.template || DEFAULT_TEMPLATE,
    templateTaskDone: config.templateTaskDone || DEFAULT_TASK_DONE_TEMPLATE,
  };

  // 1. Save to localStorage
  localStorage.setItem(LOCAL_STORAGE_EXTENDED_KEY, JSON.stringify(merged));
  localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(merged));

  // 2. Save to Supabase whatsapp_settings table
  try {
    const now = new Date().toISOString();

    // Default master record with active provider indicator
    await supabase.from('whatsapp_settings').upsert({
      id: 'default',
      product_id: merged.provider, // stores active provider ('maytapi' or 'aisensy')
      phone_id: merged.provider === 'maytapi' ? merged.phoneId : null,
      token: merged.provider === 'aisensy' ? merged.aisensyApiKey : merged.token,
      api_url: merged.provider === 'aisensy' ? merged.aisensyApiUrl : merged.apiUrl,
      enabled: merged.enabled,
      template: merged.template,
      updated_at: now,
    }, { onConflict: 'id' });

    // Dedicated Maytapi record
    if (merged.productId || merged.token) {
      await supabase.from('whatsapp_settings').upsert({
        id: 'maytapi',
        product_id: merged.productId,
        phone_id: merged.phoneId,
        token: merged.token,
        api_url: merged.apiUrl,
        enabled: merged.enabled,
        template: merged.template,
        updated_at: now,
      }, { onConflict: 'id' });
    }

    // Dedicated AiSensy record
    if (merged.aisensyApiKey || merged.aisensyCampaignName) {
      await supabase.from('whatsapp_settings').upsert({
        id: 'aisensy',
        product_id: merged.aisensyCampaignName,
        phone_id: null,
        token: merged.aisensyApiKey,
        api_url: merged.aisensyApiUrl,
        enabled: merged.enabled,
        template: merged.template,
        updated_at: now,
      }, { onConflict: 'id' });
    }

    // Dedicated Task Done Template record
    await supabase.from('whatsapp_settings').upsert({
      id: 'task_done',
      product_id: merged.aisensyDoneCampaignName || null,
      phone_id: null,
      token: null,
      api_url: null,
      enabled: merged.enabled,
      template: merged.templateTaskDone,
      updated_at: now,
    }, { onConflict: 'id' });
  } catch (e) {
    console.warn('Could not sync config to Supabase whatsapp_settings table:', e);
  }

  return merged;
};

/**
 * Backward compatibility alias for saveMaytapiConfig
 */
export const saveMaytapiConfig = saveWhatsappConfig;

/**
 * Format raw phone number into standard 12-digit Indian number or international number
 */
export const formatPhoneNumber = (rawNumber) => {
  if (!rawNumber) return null;
  const str = String(rawNumber).trim();

  // Strip non-digit characters except leading plus if any
  let digits = str.replace(/\D/g, '');
  if (!digits) return null;

  // If 10 digits, assume India (+91)
  if (digits.length === 10) {
    digits = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = `91${digits.substring(1)}`;
  }

  return digits;
};

/**
 * Look up a user's phone number by username in the Whatsapp table data
 */
export const getUserPhone = (username, usersList = []) => {
  if (!username) return null;
  const target = String(username).trim().toLowerCase();

  const matchedUser = (usersList || []).find((u) => {
    const uName = (u.Username || u['User name'] || u.Name || '').trim().toLowerCase();
    return uName === target;
  });

  if (matchedUser && matchedUser.Number) {
    return matchedUser.Number;
  }
  return null;
};

/**
 * Generate formatted WhatsApp message for Task Assignment
 */
export const generateDelegationMessage = (taskData, templateString = DEFAULT_TEMPLATE) => {
  const template = templateString || DEFAULT_TEMPLATE;

  const name = taskData.Name || taskData.doer || 'Team Member';
  const taskId = taskData['Task ID'] || taskData.taskId || taskData.id || '-';
  const givenBy = taskData['Given By'] || taskData.givenBy || taskData['Give By'] || 'Management';
  const description = taskData['Task Description'] || taskData.description || taskData['Tast Descriptions'] || '-';
  const startDate = taskData['Task Start Date'] || taskData.startDate || taskData['Task Start date'] || taskData['Planned Date'] || '-';

  return template
    .replace(/\$\(Name\)/g, name)
    .replace(/\$\(Task ID\)/g, String(taskId))
    .replace(/\$\(Given By\)/g, givenBy)
    .replace(/\$\(Task Description\)/g, description)
    .replace(/\$\(Task Start Date\)/g, startDate);
};

/**
 * Generate formatted WhatsApp message for Task Completion (Sent to Given By)
 */
export const generateDelegationDoneMessage = (taskData, templateString = DEFAULT_TASK_DONE_TEMPLATE) => {
  const template = templateString || DEFAULT_TASK_DONE_TEMPLATE;

  const givenBy = taskData['Given By'] || taskData.givenBy || taskData['Give By'] || 'Admin';
  const name = taskData.Name || taskData.doer || taskData['Doer Name'] || 'Team Member';
  const taskId = taskData['Task ID'] || taskData['Task id'] || taskData.taskId || taskData.id || '-';
  const description = taskData['Task Description'] || taskData.description || taskData['Tast Descriptions'] || '-';
  const completionDate = taskData['Completion Date'] || taskData.completionDate || taskData.Timestamp || new Date().toLocaleDateString('en-GB');
  const remarks = taskData.Remarks || taskData.remarks || taskData.Reason || taskData.reason || 'Completed';
  const rawAttachment = taskData.Attachment || taskData['Upload Image'] || taskData['Upload Imgage'] || taskData.imageUrl || '';
  const attachment = (typeof rawAttachment === 'string' && rawAttachment.trim().startsWith('http'))
    ? rawAttachment.trim()
    : (typeof rawAttachment === 'string' && rawAttachment.trim() ? rawAttachment.trim() : 'Not attached');

  return template
    .replace(/\$\(Given By\)/g, givenBy)
    .replace(/\$\(Name\)/g, name)
    .replace(/\$\(Task ID\)/g, String(taskId))
    .replace(/\$\(Task Description\)/g, description)
    .replace(/\$\(Completion Date\)/g, completionDate)
    .replace(/\$\(Remarks\)/g, remarks)
    .replace(/\$\(Attachment\)/g, attachment);
};

/**
 * Record a WhatsApp log in Supabase whatsapp_logs table and localStorage
 */
export const recordWhatsappLog = async (logEntry) => {
  const provider = logEntry.provider || 'Maytapi';
  const newLog = {
    id: logEntry.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    created_at: logEntry.created_at || new Date().toISOString(),
    task_id: String(logEntry.task_id || logEntry.taskId || ''),
    recipient_name: logEntry.recipient_name || logEntry.recipientName || '',
    recipient_phone: logEntry.recipient_phone || logEntry.recipientPhone || '',
    allocated_by: logEntry.allocated_by || logEntry.allocatedBy || '',
    message: logEntry.message || '',
    status: logEntry.status || 'Sent', // 'Sent' | 'Failed' | 'Delivered'
    provider: provider,
    response: logEntry.response ? { ...logEntry.response, _provider: provider } : { _provider: provider },
    error: logEntry.error || null,
  };

  // 1. Save to localStorage cache (keeps last 200 logs)
  try {
    const existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_LOGS_KEY) || '[]');
    const updated = [newLog, ...existing].slice(0, 200);
    localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save log to localStorage:', e);
  }

  // 2. Try inserting into Supabase whatsapp_logs table or whatsapp_log table
  try {
    const { error: insErr } = await supabase
      .from('whatsapp_logs')
      .insert([{
        task_id: newLog.task_id,
        recipient_name: newLog.recipient_name,
        recipient_phone: newLog.recipient_phone,
        allocated_by: newLog.allocated_by,
        message: newLog.message,
        status: newLog.status,
        response: newLog.response,
        error: newLog.error,
        created_at: newLog.created_at,
      }]);

    if (insErr) {
      await supabase
        .from('whatsapp_log')
        .insert([{
          task_id: newLog.task_id,
          recipient_name: newLog.recipient_name,
          recipient_phone: newLog.recipient_phone,
          allocated_by: newLog.allocated_by,
          message: newLog.message,
          status: newLog.status,
          response: newLog.response,
          error: newLog.error,
          created_at: newLog.created_at,
        }]);
    }
  } catch (e) {
    console.warn('Could not insert to Supabase whatsapp_logs table:', e);
  }

  return newLog;
};

/**
 * Fetch all WhatsApp logs from Supabase or localStorage
 */
export const getWhatsappLogs = async () => {
  try {
    const { data, error } = await supabase
      .from('whatsapp_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((log) => ({
        ...log,
        provider: log.provider || log.response?._provider || (log.message?.includes('AiSensy') ? 'AiSensy' : 'Maytapi'),
      }));
    }

    const { data: d2, error: e2 } = await supabase
      .from('whatsapp_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    if (!e2 && Array.isArray(d2) && d2.length > 0) {
      return d2.map((log) => ({
        ...log,
        provider: log.provider || log.response?._provider || (log.message?.includes('AiSensy') ? 'AiSensy' : 'Maytapi'),
      }));
    }
  } catch (e) {
    console.warn('Could not fetch logs from Supabase:', e);
  }

  try {
    const local = JSON.parse(localStorage.getItem(LOCAL_STORAGE_LOGS_KEY) || '[]');
    return local.map((log) => ({
      ...log,
      provider: log.provider || log.response?._provider || (log.message?.includes('AiSensy') ? 'AiSensy' : 'Maytapi'),
    }));
  } catch (e) {
    return [];
  }
};

/**
 * Clear WhatsApp logs
 */
export const clearWhatsappLogs = async () => {
  localStorage.removeItem(LOCAL_STORAGE_LOGS_KEY);
  try {
    await supabase.from('whatsapp_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  } catch (e) {}
  try {
    await supabase.from('whatsapp_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  } catch (e) {}
};

/**
 * Send WhatsApp SMS via Maytapi API
 */
export const sendMaytapiSMS = async ({
  toNumber,
  message,
  taskId = '',
  recipientName = '',
  allocatedBy = '',
  configOverride = null,
}) => {
  const config = configOverride || (await getWhatsappConfig());

  if (!config.enabled) {
    console.log('Maytapi WhatsApp SMS is currently disabled in Settings.');
    return { success: false, skipped: true, error: 'WhatsApp SMS is disabled in Settings' };
  }

  const rawProductId = config?.productId || '';
  const rawPhoneId = config?.phoneId || '';
  const rawToken = config?.token || '';
  const rawApiUrl = config?.apiUrl || 'https://api.maytapi.com/api';

  const productId = String(rawProductId).trim();
  const phoneId = String(rawPhoneId).trim();
  const token = String(rawToken).trim();
  const apiUrl = String(rawApiUrl).trim();

  if (!productId || !phoneId || !token) {
    const err = 'Maytapi credentials missing (Product ID, Phone ID or Token). Please configure in Settings > Whatsapp SMS.';
    console.warn(err);
    await recordWhatsappLog({
      task_id: taskId,
      recipient_name: recipientName,
      recipient_phone: toNumber || 'N/A',
      allocated_by: allocatedBy,
      message,
      status: 'Failed',
      error: err,
      provider: 'Maytapi',
    });
    return { success: false, error: err };
  }

  const formattedNumber = formatPhoneNumber(toNumber);
  if (!formattedNumber) {
    const err = `Invalid phone number for user "${recipientName}": ${toNumber}`;
    console.warn(err);
    await recordWhatsappLog({
      task_id: taskId,
      recipient_name: recipientName,
      recipient_phone: toNumber || 'Invalid',
      allocated_by: allocatedBy,
      message,
      status: 'Failed',
      error: err,
      provider: 'Maytapi',
    });
    return { success: false, error: err };
  }

  const baseUrl = (apiUrl || 'https://api.maytapi.com/api').replace(/\/+$/, '');
  const endpoint = `${baseUrl}/${productId}/${phoneId}/sendMessage`;

  const payload = {
    to_number: `${formattedNumber}@c.us`,
    type: 'text',
    message: message,
  };

  try {
    console.log(`Sending WhatsApp SMS via Maytapi to ${formattedNumber}...`);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-maytapi-key': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const resJson = await response.json().catch(() => null);

    if (response.ok && (resJson?.success !== false)) {
      console.log(`WhatsApp SMS sent successfully via Maytapi to ${recipientName} (${formattedNumber})!`);
      const log = await recordWhatsappLog({
        task_id: taskId,
        recipient_name: recipientName,
        recipient_phone: formattedNumber,
        allocated_by: allocatedBy,
        message,
        status: 'Sent',
        response: resJson,
        provider: 'Maytapi',
      });
      return { success: true, log, data: resJson };
    } else {
      const errMsg = resJson?.message || resJson?.error || `HTTP ${response.status}: ${response.statusText}`;
      console.error('Maytapi API Error:', errMsg, resJson);
      const log = await recordWhatsappLog({
        task_id: taskId,
        recipient_name: recipientName,
        recipient_phone: formattedNumber,
        allocated_by: allocatedBy,
        message,
        status: 'Failed',
        response: resJson,
        error: errMsg,
        provider: 'Maytapi',
      });
      return { success: false, error: errMsg, log, data: resJson };
    }
  } catch (error) {
    console.error('Network error calling Maytapi API:', error);
    const log = await recordWhatsappLog({
      task_id: taskId,
      recipient_name: recipientName,
      recipient_phone: formattedNumber,
      allocated_by: allocatedBy,
      message,
      status: 'Failed',
      error: error.message || String(error),
      provider: 'Maytapi',
    });
    return { success: false, error: error.message || String(error), log };
  }
};

/**
 * Send WhatsApp SMS via AiSensy Campaign API
 */
export const sendAisensySMS = async ({
  toNumber,
  message,
  taskId = '',
  recipientName = '',
  allocatedBy = '',
  taskDescription = '',
  startDate = '',
  mediaUrl = null,
  templateParams = null,
  campaignNameOverride = null,
  configOverride = null,
}) => {
  const config = configOverride || (await getWhatsappConfig());

  if (!config.enabled) {
    console.log('AiSensy WhatsApp SMS is currently disabled in Settings.');
    return { success: false, skipped: true, error: 'WhatsApp SMS is disabled in Settings' };
  }

  const apiKey = String(config?.aisensyApiKey || '').trim();
  const rawCampaign = campaignNameOverride || config?.aisensyCampaignName || '';
  const campaignName = String(rawCampaign).trim();
  const apiUrl = String(config?.aisensyApiUrl || 'https://backend.aisensy.com/campaign/t1/api/v2').trim();

  if (!apiKey || !campaignName) {
    const err = 'AiSensy credentials missing (API Key or Campaign Name). Please configure in Settings > Whatsapp SMS.';
    console.warn(err);
    await recordWhatsappLog({
      task_id: taskId,
      recipient_name: recipientName,
      recipient_phone: toNumber || 'N/A',
      allocated_by: allocatedBy,
      message: message || `AiSensy Campaign: ${campaignName}`,
      status: 'Failed',
      error: err,
      provider: 'AiSensy',
    });
    return { success: false, error: err };
  }

  const formattedNumber = formatPhoneNumber(toNumber);
  if (!formattedNumber) {
    const err = `Invalid phone number for user "${recipientName}": ${toNumber}`;
    console.warn(err);
    await recordWhatsappLog({
      task_id: taskId,
      recipient_name: recipientName,
      recipient_phone: toNumber || 'Invalid',
      allocated_by: allocatedBy,
      message: message || `AiSensy Campaign: ${campaignName}`,
      status: 'Failed',
      error: err,
      provider: 'AiSensy',
    });
    return { success: false, error: err };
  }

  // Ensure destination format (+91XXXXXXXXXX)
  const destination = formattedNumber.startsWith('+') ? formattedNumber : `+${formattedNumber}`;

  // Build template parameters for AiSensy placeholders
  const params = (Array.isArray(templateParams) && templateParams.length > 0)
    ? templateParams
    : [
        recipientName || 'Team Member',
        String(taskId || '-'),
        String(allocatedBy || 'Management'),
        String(taskDescription || '-'),
        String(startDate || '-')
      ];

  const payload = {
    apiKey: apiKey,
    campaignName: campaignName,
    destination: destination,
    userName: recipientName || 'User',
    templateParams: params,
    source: 'Task Delegation System',
    tags: ['Task Delegation']
  };

  if (mediaUrl && String(mediaUrl).startsWith('http')) {
    payload.media = {
      url: String(mediaUrl).trim(),
      filename: 'task_attachment.jpg'
    };
  }

  try {
    console.log(`Sending WhatsApp SMS via AiSensy to ${destination} (Campaign: ${campaignName})...`);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const resJson = await response.json().catch(() => null);

    const isSuccess = response.ok &&
      (resJson?.success !== false) &&
      (resJson?.status !== 'error') &&
      (resJson?.submitted !== false);

    if (isSuccess) {
      console.log(`WhatsApp SMS sent successfully via AiSensy to ${recipientName} (${destination})!`);
      const log = await recordWhatsappLog({
        task_id: taskId,
        recipient_name: recipientName,
        recipient_phone: destination,
        allocated_by: allocatedBy,
        message: message || `AiSensy Campaign: ${campaignName} [${params.join(', ')}]`,
        status: 'Sent',
        response: resJson,
        provider: 'AiSensy',
      });
      return { success: true, log, data: resJson };
    } else {
      const errMsg = resJson?.message || resJson?.error || `HTTP ${response.status}: ${response.statusText}`;
      console.error('AiSensy API Error:', errMsg, resJson);
      const log = await recordWhatsappLog({
        task_id: taskId,
        recipient_name: recipientName,
        recipient_phone: destination,
        allocated_by: allocatedBy,
        message: message || `AiSensy Campaign: ${campaignName} [${params.join(', ')}]`,
        status: 'Failed',
        response: resJson,
        error: errMsg,
        provider: 'AiSensy',
      });
      return { success: false, error: errMsg, log, data: resJson };
    }
  } catch (error) {
    console.error('Network error calling AiSensy API:', error);
    const log = await recordWhatsappLog({
      task_id: taskId,
      recipient_name: recipientName,
      recipient_phone: destination,
      allocated_by: allocatedBy,
      message: message || `AiSensy Campaign: ${campaignName}`,
      status: 'Failed',
      error: error.message || String(error),
      provider: 'AiSensy',
    });
    return { success: false, error: error.message || String(error), log };
  }
};

/**
 * Generic WhatsApp SMS sender that automatically dispatches to the active provider (Maytapi or AiSensy)
 */
export const sendWhatsappSMS = async (options) => {
  const config = options.configOverride || (await getWhatsappConfig());
  const activeProvider = (config.provider || 'maytapi').toLowerCase();

  if (activeProvider === 'aisensy') {
    return await sendAisensySMS({ ...options, configOverride: config });
  } else {
    return await sendMaytapiSMS({ ...options, configOverride: config });
  }
};

/**
 * Send WhatsApp SMS specifically when a new Delegation Task is created (Sent to Doer/Assignee)
 */
export const sendDelegationTaskSMS = async (taskData, usersList = []) => {
  try {
    const config = taskData?.configOverride || (await getWhatsappConfig());
    if (!config.enabled) return { success: false, skipped: true };

    const recipientName = taskData.Name || taskData.doer || '';
    let phoneNumber = taskData.Number || taskData.phone || null;

    if (!phoneNumber && recipientName) {
      phoneNumber = getUserPhone(recipientName, usersList);

      if (!phoneNumber) {
        try {
          const { data: uData } = await supabase
            .from('Whatsapp')
            .select('Number, Username')
            .ilike('Username', recipientName.trim())
            .maybeSingle();

          if (uData && uData.Number) {
            phoneNumber = uData.Number;
          }
        } catch (e) {
          console.warn('Could not query user phone from Supabase:', e);
        }
      }
    }

    const message = generateDelegationMessage(taskData, config.template);
    const taskId = taskData['Task ID'] || taskData.taskId || taskData.id || '';
    const allocatedBy = taskData['Given By'] || taskData.givenBy || taskData['Give By'] || 'Admin';
    const taskDescription = taskData['Task Description'] || taskData.description || taskData['Tast Descriptions'] || '-';
    const startDate = taskData['Task Start Date'] || taskData.startDate || taskData['Task Start date'] || taskData['Planned Date'] || '-';

    return await sendWhatsappSMS({
      toNumber: phoneNumber,
      message,
      taskId: String(taskId),
      recipientName,
      allocatedBy,
      taskDescription,
      startDate,
      configOverride: config,
    });
  } catch (error) {
    console.error('Error in sendDelegationTaskSMS:', error);
    return { success: false, error: error.message || error };
  }
};

/**
 * Send WhatsApp SMS specifically when a Delegation Task is COMPLETED (Sent to Given By / Creator)
 */
export const sendDelegationDoneSMS = async (taskData, usersList = []) => {
  try {
    const config = taskData?.configOverride || (await getWhatsappConfig());
    if (!config.enabled) return { success: false, skipped: true };

    const givenByName = taskData['Given By'] || taskData.givenBy || taskData['Give By'] || '';
    if (!givenByName) {
      console.warn('Cannot send completion SMS: Given By is missing');
      return { success: false, skipped: true, error: 'Given By is missing' };
    }

    let phoneNumber = taskData['Given By Phone'] || taskData.givenByPhone || null;

    if (!phoneNumber) {
      phoneNumber = getUserPhone(givenByName, usersList);

      if (!phoneNumber) {
        try {
          const { data: uData } = await supabase
            .from('Whatsapp')
            .select('Number, Username')
            .ilike('Username', givenByName.trim())
            .maybeSingle();

          if (uData && uData.Number) {
            phoneNumber = uData.Number;
          }
        } catch (e) {
          console.warn('Could not query Given By phone from Supabase:', e);
        }
      }
    }

    const templateToUse = config.templateTaskDone || DEFAULT_TASK_DONE_TEMPLATE;
    const message = generateDelegationDoneMessage(taskData, templateToUse);
    const taskId = taskData['Task ID'] || taskData['Task id'] || taskData.taskId || taskData.id || '';
    const doerName = taskData.Name || taskData.doer || 'Team Member';
    const taskDescription = taskData['Task Description'] || taskData.description || '-';
    const completionDate = taskData['Completion Date'] || taskData.completionDate || taskData.Timestamp || new Date().toLocaleDateString('en-GB');
    const attachmentUrl = taskData.Attachment || taskData['Upload Image'] || taskData['Upload Imgage'] || taskData.imageUrl || '';
    const attachmentDisplay = attachmentUrl && String(attachmentUrl).startsWith('http') ? String(attachmentUrl).trim() : 'Not attached';

    // For AiSensy:
    // {{1}} = Given By (Manager/Admin Name)
    // {{2}} = Task ID
    // {{3}} = Completed By (Doer Name)
    // {{4}} = Task Description
    // {{5}} = Completion Date
    // {{6}} = Attachment URL
    const templateParams = [
      givenByName,
      String(taskId || '-'),
      doerName,
      taskDescription,
      completionDate,
      attachmentDisplay
    ];

    const campaignToUse = config.aisensyDoneCampaignName || config.aisensyCampaignName;

    return await sendWhatsappSMS({
      toNumber: phoneNumber,
      message,
      taskId: String(taskId),
      recipientName: givenByName,
      allocatedBy: doerName,
      taskDescription,
      startDate: completionDate,
      mediaUrl: (attachmentUrl && String(attachmentUrl).startsWith('http')) ? String(attachmentUrl).trim() : null,
      templateParams,
      campaignNameOverride: campaignToUse,
      configOverride: config,
    });
  } catch (error) {
    console.error('Error in sendDelegationDoneSMS:', error);
    return { success: false, error: error.message || error };
  }
};
