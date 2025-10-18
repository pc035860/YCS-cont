export interface ICommentFind {
    item: {
        commentRenderer: {
            authorEndpoint: {
                commandMetadata: {
                    webCommandMetadata: {
                        url: string;
                    };
                };
            };
            authorText: {
                simpleText: string;
            };
            authorThumbnail: {
                thumbnails: [
                    {
                        url: string;
                    },
                    {
                        url: string;
                    },
                    {
                        url: string;
                    }
                ];
            };
            publishedTimeText: {
                runs: [
                    {
                        text: string;
                        navigationEndpoint: {
                            commandMetadata: {
                                webCommandMetadata: {
                                    url: string;
                                };
                            };
                        };
                    }
                ];
            };
            contentText: {
                fullText: string;
            };
        };
        typeComment: string;
        originComment: object;
    };
    refIndex: number;
}
