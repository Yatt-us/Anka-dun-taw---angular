import { environment } from '../../../environments/environment';

/** Base API : proxy local en développement, service Render en production. */
export const API_BASE_URL = environment.apiBaseUrl;
