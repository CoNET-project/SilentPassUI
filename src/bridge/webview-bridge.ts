type CallbackFunction = (response: any) => void;

interface BridgeMessage {
  	event?: string;
  	data?: any;
  	callbackId?: string;
  	response?: any;
}

const callbacks: Record<string, CallbackFunction> = {};

let callId = 0;

function generateCallbackId(): string {
  	return `cb_${Date.now()}_${callId++}`;
}

function makeSend(messageStr: string): void {
  	if ((window as any).ReactNativeWebView?.postMessage) {	// Android/iOS
    	(window as any).ReactNativeWebView.postMessage(messageStr);
  	} else if ((window as any).webkit?.messageHandlers?.webviewMessage?.postMessage) {	// iOS 原生
    	(window as any).webkit.messageHandlers.webviewMessage.postMessage(messageStr);
  	} else if ((window as any).electron?.send) {	// Electron
    	(window as any).electron.send(messageStr);
  	} else {
    	console.warn("No bridge available");
  	}
}

export const Bridge = {
  	send(event: string, data: any, callback?: CallbackFunction): void {
    	const message: BridgeMessage = { event, data };

	    if (callback) {
	      	const callbackId = generateCallbackId();
	      	message.callbackId = callbackId;
	      	callbacks[callbackId] = callback;
	    }

	    const messageStr = JSON.stringify(message);
	    makeSend(messageStr);
  	},
  	receive(rawMessage: string, normalReceiveToDo?: (message: BridgeMessage, makeSend: any) => void): void {
    	if (typeof rawMessage !== "string") return;

    	let message: BridgeMessage;
    	try {
      		message = JSON.parse(rawMessage);
    	} catch (e) {
      		console.warn("Failed to parse message", e);
      		return;
    	}

    	if (message.callbackId && message.response !== undefined) {	// 处理回调响应
      		// Handle response callback
      		const cb = callbacks[message.callbackId];
      		if (cb) {
        		cb(message.response);
        		delete callbacks[message.callbackId];
      		}
    	} else {	
    		// 正常收到事件
    		if(normalReceiveToDo){normalReceiveToDo(message,makeSend)}
    	}
  	}
}

// 监听 Electron 或 Native 的回传
window.addEventListener('message', (e: MessageEvent) => {
  	Bridge.receive(e.data);
});