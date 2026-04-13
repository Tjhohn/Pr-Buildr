/**
 * Message types for communication between extension host and webview.
 */

/** Messages sent from the extension to the webview */
export type ToWebviewMessage =
  | {
      type: "init";
      data: {
        branches: string[];
        base: string;
        head: string;
        templateSource: string;
        provider: string;
        model: string;
        jiraEnabled: boolean;
        jiraProjectUrl?: string;
        jiraProjectKey?: string;
        jiraTicketId?: string;
      };
    }
  | {
      type: "draft";
      data: {
        title: string;
        body: string;
      };
    }
  | {
      type: "status";
      data: {
        message: string;
        isError?: boolean;
      };
    }
  | {
      type: "creating";
    }
  | {
      type: "created";
      data: {
        url: string;
        number: number;
        draft: boolean;
      };
    }
  // ── Image messages ──
  | {
      type: "imageAdded";
      data: {
        id: string;
        fileName: string;
        altText: string;
        previewDataUrl: string;
      };
    }
  | {
      type: "imageRemoved";
      data: {
        id: string;
      };
    }
  | {
      type: "uploadingImages";
      data: {
        current: number;
        total: number;
      };
    }
  | {
      type: "imageUploadFailed";
      data: {
        message: string;
        failedImages: string[];
      };
    };

/** Messages sent from the webview to the extension */
export type FromWebviewMessage =
  | {
      type: "generate";
      data: {
        base: string;
      };
    }
  | {
      type: "create";
      data: {
        title: string;
        body: string;
        base: string;
        draft: boolean;
        jiraTicketId?: string;
      };
    }
  | {
      type: "changeBase";
      data: {
        base: string;
      };
    }
  | {
      type: "regenerate";
    }
  | {
      type: "configureJira";
    }
  | {
      type: "ignoreIntegrations";
    }
  // ── Image messages ──
  | {
      type: "addImage";
    }
  | {
      type: "removeImage";
      data: {
        id: string;
      };
    }
  | {
      type: "updateImageAlt";
      data: {
        id: string;
        altText: string;
      };
    };
