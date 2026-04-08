// Google Sheets sync via Apps Script
export async function saveToGoogle(
  url: string,
  password: string,
  data: string,
): Promise<boolean> {
  if (!url) return false;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Password": password,
      },
      body: JSON.stringify({ action: "save", data, password }),
    });
    const result = (await response.json()) as Record<string, unknown>;
    return result.success === true;
  } catch {
    return false;
  }
}

export async function loadFromGoogle(
  url: string,
  password: string,
): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(
      `${url}?action=load&password=${encodeURIComponent(password)}`,
      {
        method: "GET",
      },
    );
    const result = (await response.json()) as Record<string, unknown>;
    if (result.error) return null;
    return typeof result.data === "string"
      ? result.data
      : JSON.stringify(result.data);
  } catch {
    return null;
  }
}

export const APPS_SCRIPT_CODE = `function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const SECRET = 'MON_MOT_DE_PASSE_SECRET'; // Changez ce mot de passe
  if (params.password !== SECRET) {
    return ContentService.createTextOutput(JSON.stringify({error:'Accès refusé'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const props = PropertiesService.getScriptProperties();
  props.setProperty('revenueplanner_data', params.data);
  return ContentService.createTextOutput(JSON.stringify({success:true}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const SECRET = 'MON_MOT_DE_PASSE_SECRET'; // Changez ce mot de passe
  if (e.parameter.password !== SECRET) {
    return ContentService.createTextOutput(JSON.stringify({error:'Accès refusé'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const props = PropertiesService.getScriptProperties();
  const data = props.getProperty('revenueplanner_data') || '{}';
  return ContentService.createTextOutput(JSON.stringify({data:data}))
    .setMimeType(ContentService.MimeType.JSON);
}`;
