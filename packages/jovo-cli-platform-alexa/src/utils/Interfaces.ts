import { AppFile, JovoTaskContext } from 'jovo-cli-core';

export interface AlexaEventSubscription {
  eventName: string;
}

export interface AlexaManifest {
  events?: {
    endpoint?: {
      uri: string;
    };
  };
  subscriptions?: AlexaEventSubscription[];
}

export interface AppFileAlexa extends AppFile {
  alexaSkill?: {
    nlu?: {
      name: string;
    };
    manifest?: AlexaManifest;
  };
}

export interface AskSkillList {
  skills: [
    {
      skillId: string;
      stage: string | undefined;
      nameByLocale: {
        [key: string]: string;
      };
      lastUpdated: string;
    },
  ];
}

export interface JovoTaskContextAlexa extends JovoTaskContext {
  askProfile: string;
  accessToken: string;
  lambdaArn?: string;
  skillId?: string;
  info?: string;
  newSkill?: boolean;
}

export interface SMAPIResponse {
  data: any;
  headers: any;
  statusCode: number;
}

export interface RequestOptions {
  method: string;
  path: string;
  hostname?: string;
  headers?: {
    'Content-Length'?: number;
    'Content-Type'?: string;
    'Authorization'?: string;
  };
}

export interface RequestBody {
  [key: string]: any;
}
