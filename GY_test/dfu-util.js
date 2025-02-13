var device = null;

(function () {
    'use strict';
    //格式转化
    function hex4(n) {
        let s = n.toString(16)
        while (s.length < 4) {
            s = '0' + s;
        }
        return s;
    }
    //格式转化
    function hexAddr8(n) {
        let s = n.toString(16)
        while (s.length < 8) {
            s = '0' + s;
        }
        return "0x" + s;
    }
    //格式转化
    function niceSize(n) {
        const gigabyte = 1024 * 1024 * 1024;
        const megabyte = 1024 * 1024;
        const kilobyte = 1024;
        if (n >= gigabyte) {
            return n / gigabyte + "GiB";
        } else if (n >= megabyte) {
            return n / megabyte + "MiB";
        } else if (n >= kilobyte) {
            return n / kilobyte + "KiB";
        } else {
            return n + "B";
        }
    }
    // 需要保留
    function formatDFUSummary(device) {
        console.log("formatDFUSummary");
        const vid = hex4(device.device_.vendorId);
        const pid = hex4(device.device_.productId);
        const name = device.device_.productName;

        let mode = "Unknown"
        if (device.settings.alternate.interfaceProtocol == 0x01) {
            mode = "Runtime";
        } else if (device.settings.alternate.interfaceProtocol == 0x02) {
            mode = "DFU";
        }

        const cfg = device.settings.configuration.configurationValue;
        const intf = device.settings["interface"].interfaceNumber;
        const alt = device.settings.alternate.alternateSetting;
        const serial = device.device_.serialNumber;
        let info = `${mode}: [${vid}:${pid}] cfg=${cfg}, intf=${intf}, alt=${alt}, name="${name}" serial="${serial}"`;
        return info;
    }
    //未触发
    // function formatDFUInterfaceAlternate(settings) {
    //     console.log("formatDFUInterfaceAlternate");
    //     let mode = "Unknown"
    //     if (settings.alternate.interfaceProtocol == 0x01) {
    //         mode = "Runtime";
    //     } else if (settings.alternate.interfaceProtocol == 0x02) {
    //         mode = "DFU";
    //     }

    //     const cfg = settings.configuration.configurationValue;
    //     const intf = settings["interface"].interfaceNumber;
    //     const alt = settings.alternate.alternateSetting;
    //     const name = (settings.name) ? settings.name : "UNKNOWN";

    //     return `${mode}: cfg=${cfg}, intf=${intf}, alt=${alt}, name="${name}"`;
    // }
    //需要保留
    async function fixInterfaceNames(device_, interfaces) {
        console.log("fixInterfaceNames");
        // Check if any interface names were not read correctly
        if (interfaces.some(intf => (intf.name == null))) {
            // Manually retrieve the interface name string descriptors
            let tempDevice = new dfu.Device(device_, interfaces[0]);
            await tempDevice.device_.open();
            await tempDevice.device_.selectConfiguration(1);
            let mapping = await tempDevice.readInterfaceNames();
            await tempDevice.close();

            for (let intf of interfaces) {
                if (intf.name === null) {
                    let configIndex = intf.configuration.configurationValue;
                    let intfNumber = intf["interface"].interfaceNumber;
                    let alt = intf.alternate.alternateSetting;
                    intf.name = mapping[configIndex][intfNumber][alt];
                }
            }
        }
    }
    //根据接口列表填充表单 以及实现不同功能  暂未使用
    // function populateInterfaceList(form, device_, interfaces) {
    //     console.log("populateInterfaceList");
    //     let old_choices = Array.from(form.getElementsByTagName("div"));
    //     for (let radio_div of old_choices) {
    //         form.removeChild(radio_div);
    //     }

    //     let button = form.getElementsByTagName("button")[0];

    //     for (let i = 0; i < interfaces.length; i++) {
    //         let radio = document.createElement("input");
    //         radio.type = "radio";
    //         radio.name = "interfaceIndex";
    //         radio.value = i;
    //         radio.id = "interface" + i;
    //         radio.required = true;

    //         let label = document.createElement("label");
    //         label.textContent = formatDFUInterfaceAlternate(interfaces[i]);
    //         label.className = "radio"
    //         label.setAttribute("for", "interface" + i);

    //         let div = document.createElement("div");
    //         div.appendChild(radio);
    //         div.appendChild(label);
    //         form.insertBefore(div, button);
    //     }
    // }
    //需要保留
    function getDFUDescriptorProperties(device) {
        console.log("getDFUDescriptorProperties");
        // Attempt to read the DFU functional descriptor
        // TODO: read the selected configuration's descriptor
        console.log("getDFUDescriptorProperties", device, "目前操作未知");
        return device.readConfigurationDescriptor(0).then(
            data => {
                let configDesc = dfu.parseConfigurationDescriptor(data);
                let funcDesc = null;
                let configValue = device.settings.configuration.configurationValue;
                if (configDesc.bConfigurationValue == configValue) {
                    for (let desc of configDesc.descriptors) {
                        if (desc.bDescriptorType == 0x21 && desc.hasOwnProperty("bcdDFUVersion")) {
                            funcDesc = desc;
                            break;
                        }
                    }
                }

                if (funcDesc) {
                    return {
                        WillDetach: ((funcDesc.bmAttributes & 0x08) != 0),
                        ManifestationTolerant: ((funcDesc.bmAttributes & 0x04) != 0),
                        //     CanUpload: ((funcDesc.bmAttributes & 0x02) != 0),
                        CanDnload: ((funcDesc.bmAttributes & 0x01) != 0),
                        //   TransferSize: funcDesc.wTransferSize,
                        DetachTimeOut: funcDesc.wDetachTimeOut,
                        DFUVersion: funcDesc.bcdDFUVersion
                    };
                } else {
                    return {};
                }
            },
            error => { }
        );
    }

    // Current log div element to append to
    let logContext = null;

    function setLogContext(div) {
        console.log("setLogContext", div);
        logContext = div;
    };
    //清空日志
    function clearLog(context) {
        console.log("clearLog", context);
        if (typeof context === 'undefined') {
            context = logContext;
        }
        if (context) {
            context.innerHTML = "";
        }
    }
    // 输出日志函数
    function logDebug(msg) {
        console.log(msg);
    }
    // 日志函数
    function logInfo(msg) {
        console.log("logInfo");
        if (logContext) {
            let info = document.createElement("p");
            info.className = "info";
            info.textContent = msg;
            logContext.appendChild(info);
        }
    }
    // 日志警告函数
    function logWarning(msg) {
        console.log("logWarning");
        if (logContext) {
            let warning = document.createElement("p");
            warning.className = "warning";
            warning.textContent = msg;
            logContext.appendChild(warning);
        }
    }
    // 日志错误函数
    function logError(msg) {
        console.log("logError");
        if (logContext) {
            let error = document.createElement("p");
            error.className = "error";
            error.textContent = msg;
            logContext.appendChild(error);
        }
    }
    // 日志进度函数
    function logProgress(done, total) {
        console.log("logProgress");
        if (logContext) {
            let progressBar;
            if (logContext.lastChild.tagName.toLowerCase() == "progress") {
                progressBar = logContext.lastChild;
            }
            if (!progressBar) {
                progressBar = document.createElement("progress");
                logContext.appendChild(progressBar);
            }
            progressBar.value = done;
            if (typeof total !== 'undefined') {
                progressBar.max = total;
            }
        }
    }

    document.addEventListener('DOMContentLoaded', event => {
        let connectButton = document.querySelector("#connect");
        //   let detachButton = document.querySelector("#detach");
        let downloadButton = document.querySelector("#download");
        // let uploadButton = document.querySelector("#upload");
        //  let statusDisplay = document.querySelector("#status");
        //   let infoDisplay = document.querySelector("#usbInfo");
        //  let dfuDisplay = document.querySelector("#dfuInfo");
        //   let vidField = document.querySelector("#vid");
        //    let interfaceDialog = document.querySelector("#interfaceDialog");
        //    let interfaceForm = document.querySelector("#interfaceForm");
        //    let interfaceSelectButton = document.querySelector("#selectInterface");

        let searchParams = new URLSearchParams(window.location.search);
        let fromLandingPage = false;
        let vid = 0;
        // Set the vendor ID from the landing page URL
        if (searchParams.has("vid")) {
            const vidString = searchParams.get("vid");
            try {
                if (vidString.toLowerCase().startsWith("0x")) {
                    vid = parseInt(vidString, 16);
                } else {
                    vid = parseInt(vidString, 10);
                }
                //  vidField.value = "0x" + hex4(vid).toUpperCase();
                fromLandingPage = true;
            } catch (error) {
                console.log("Bad VID " + vidString + ":" + error);
            }
        }

        // Grab the serial number from the landing page
        let serial = "";
        if (searchParams.has("serial")) {
            serial = searchParams.get("serial");
            // Workaround for Chromium issue 339054
            if (window.location.search.endsWith("/") && serial.endsWith("/")) {
                serial = serial.substring(0, serial.length - 1);
            }
            fromLandingPage = true;
        }

        //   let configForm = document.querySelector("#configForm");

        // let transferSizeField = document.querySelector("#transferSize");
        //   let transferSize = parseInt(transferSizeField.value);

        //  let dfuseStartAddressField = document.querySelector("#dfuseStartAddress");
        //     let dfuseUploadSizeField = document.querySelector("#dfuseUploadSize");

        let firmwareFileField = document.querySelector("#firmwareFile");
        let firmwareFile = null;

        //   let downloadLog = document.querySelector("#downloadLog");
        // let uploadLog = document.querySelector("#uploadLog");

        let manifestationTolerant = true;

        //let device;
        //断开连接   更新结束后自动  保留
        function onDisconnect(reason) {
            console.log("Disconnected: " + reason);
            // if (reason) {
            //     statusDisplay.textContent = reason;
            // }

            connectButton.textContent = "连接";
            downloadButton.disabled = true;

            // infoDisplay.textContent = "";
            // dfuDisplay.textContent = "";
            // detachButton.disabled = true;
            // uploadButton.disabled = true;

            // firmwareFileField.disabled = true;
        }
        //获取设备描述  dfu更新结束后调用  保留
        function onUnexpectedDisconnect(event) {
            console.log("Unexpected disconnect: " + event);
            if (device !== null && device.device_ !== null) {
                if (device.device_ === event.device) {
                    device.disconnected = true;
                    onDisconnect("Device disconnected");
                    device = null;
                }
            }
        }
        //设备连接
        async function connect(device) {
            console.log("Connecting to device...");
            try {
                await device.open();
            } catch (error) {
                onDisconnect(error);
                throw error;
            }

            // Attempt to parse the DFU functional descriptor
            let desc = {};
            try {
                desc = await getDFUDescriptorProperties(device);
            } catch (error) {
                onDisconnect(error);
                throw error;
            }

            let memorySummary = "";
            console.log("l连接成功")

            let url = "https://www.guangyanjiaohu.com/download/dfu/cz60.bin"
            //let url = "..//download/dfu/cz60.bin"
            //  fetch(url, { mode: 'no-cors' });

            //跨域报错
            //   downloadFileFromUrl(url);//联网获取bin文件


            if (desc && Object.keys(desc).length > 0) {
                device.properties = desc;
                // let info = `WillDetach=${desc.WillDetach}, ManifestationTolerant=${desc.ManifestationTolerant}, CanUpload=${desc.CanUpload}, CanDnload=${desc.CanDnload}, TransferSize=${desc.TransferSize}, DetachTimeOut=${desc.DetachTimeOut}, Version=${hex4(desc.DFUVersion)}`;
                // console.log("???", info);
                // dfuDisplay.textContent += "\n" + info;
                //    transferSizeField.value = desc.TransferSize;
                //    transferSize = desc.TransferSize;
                if (desc.CanDnload) {
                    manifestationTolerant = desc.ManifestationTolerant;
                }

                if (device.settings.alternate.interfaceProtocol == 0x02) {
                    // if (!desc.CanUpload) {
                    //     uploadButton.disabled = true;
                    //     dfuseUploadSizeField.disabled = true;
                    // }
                    if (!desc.CanDnload) {
                        dnloadButton.disabled = true;
                    }
                }

                if (desc.DFUVersion == 0x011a && device.settings.alternate.interfaceProtocol == 0x02) {
                    device = new dfuse.Device(device.device_, device.settings);
                    if (device.memoryInfo) {
                        let totalSize = 0;
                        for (let segment of device.memoryInfo.segments) {
                            totalSize += segment.end - segment.start;
                        }
                        memorySummary = `Selected memory region: ${device.memoryInfo.name} (${niceSize(totalSize)})`;
                        for (let segment of device.memoryInfo.segments) {
                            let properties = [];
                            if (segment.readable) {
                                properties.push("readable");
                            }
                            if (segment.erasable) {
                                properties.push("erasable");
                            }
                            if (segment.writable) {
                                properties.push("writable");
                            }
                            let propertySummary = properties.join(", ");
                            if (!propertySummary) {
                                propertySummary = "inaccessible";
                            }

                            memorySummary += `\n${hexAddr8(segment.start)}-${hexAddr8(segment.end - 1)} (${propertySummary})`;
                        }
                    }
                }
            }

            // Bind logging methods
            device.logDebug = logDebug;
            device.logInfo = logInfo;
            device.logWarning = logWarning;
            device.logError = logError;
            device.logProgress = logProgress;

            // Clear logs
            //  clearLog(uploadLog);
            //  clearLog(downloadLog);

            // Display basic USB information
            //   statusDisplay.textContent = '';
            connectButton.textContent = '断开连接';
            // infoDisplay.textContent = (
            //     "Name: " + device.device_.productName + "\n" +
            //     "MFG: " + device.device_.manufacturerName + "\n" +
            //     "Serial: " + device.device_.serialNumber + "\n"
            // );

            // Display basic dfu-util style info
            //    dfuDisplay.textContent = formatDFUSummary(device) + "\n" + memorySummary;

            // Update buttons based on capabilities
            if (device.settings.alternate.interfaceProtocol == 0x01) {
                // Runtime
                //   detachButton.disabled = false;
                //  uploadButton.disabled = true;
                downloadButton.disabled = true;
                firmwareFileField.disabled = true;
            } else {
                // DFU
                //  detachButton.disabled = true;
                //   uploadButton.disabled = false;
                downloadButton.disabled = false;
                firmwareFileField.disabled = false;
            }

            if (device.memoryInfo) {
                //    let dfuseFieldsDiv = document.querySelector("#dfuseFields")
                //   dfuseFieldsDiv.hidden = false;
                //  dfuseStartAddressField.disabled = false;
                //   dfuseUploadSizeField.disabled = false;
                let segment = device.getFirstWritableSegment();
                if (segment) {
                    device.startAddress = segment.start;
                    //   dfuseStartAddressField.value = "0x" + segment.start.toString(16);
                    //    const maxReadSize = device.getMaxReadSize(segment.start);
                    //     dfuseUploadSizeField.value = maxReadSize;
                    //      dfuseUploadSizeField.max = maxReadSize;
                }
            } else {
                //     let dfuseFieldsDiv = document.querySelector("#dfuseFields")
                //    dfuseFieldsDiv.hidden = true;
                //  dfuseStartAddressField.disabled = true;
                //    dfuseUploadSizeField.disabled = true;
            }

            return device;
        }
        //根据vid和serial自动连接设备
        // function autoConnect(vid, serial) {
        //     console.log("autoConnect");
        //     dfu.findAllDfuInterfaces().then(
        //         async dfu_devices => {
        //             let matching_devices = [];
        //             for (let dfu_device of dfu_devices) {
        //                 if (serial) {
        //                     if (dfu_device.device_.serialNumber == serial) {
        //                         matching_devices.push(dfu_device);
        //                     }
        //                 } else if (dfu_device.device_.vendorId == vid) {
        //                     matching_devices.push(dfu_device);
        //                 }
        //             }

        //             if (matching_devices.length == 0) {
        //                 statusDisplay.textContent = 'No device found.';
        //             } else {
        //                 if (matching_devices.length == 1) {
        //                     statusDisplay.textContent = 'Connecting...';
        //                     device = matching_devices[0];
        //                     console.log(device);
        //                     device = await connect(device);
        //                 } else {
        //                     statusDisplay.textContent = "Multiple DFU interfaces found.";
        //                 }
        //                 vidField.value = "0x" + hex4(matching_devices[0].device_.vendorId).toUpperCase();
        //                 vid = matching_devices[0].device_.vendorId;
        //             }
        //         }
        //     );
        // }
        //监听vid和transferSize的变化
        // vidField.addEventListener("change", function () {
        //     console.log("vid changed Vid变化");
        //     vid = parseInt(vidField.value, 16);
        // });
        // //监听transferSize的变化 不需要
        // transferSizeField.addEventListener("change", function () {
        //     console.log("transferSize changed pid变化");
        //     transferSize = parseInt(transferSizeField.value);
        // });
        // // 监听startAddress的变化   不需要
        // dfuseStartAddressField.addEventListener("change", function (event) {
        //     console.log("startAddress changed");
        //     const field = event.target;
        //     let address = parseInt(field.value, 16);
        //     if (isNaN(address)) {
        //         field.setCustomValidity("Invalid hexadecimal start address");
        //     } else if (device && device.memoryInfo) {
        //         if (device.getSegment(address) !== null) {
        //             device.startAddress = address;
        //             field.setCustomValidity("");
        //             dfuseUploadSizeField.max = device.getMaxReadSize(address);
        //         } else {
        //             field.setCustomValidity("Address outside of memory map");
        //         }
        //     } else {
        //         field.setCustomValidity("");
        //     }
        // });
        //连接按钮 设备连接    
        connectButton.addEventListener('click', function () {
            console.log("connectButton clicked");
            if (device) {
                device.close().then(onDisconnect);
                device = null;
            } else {
                let filters = [];
                if (serial) {
                    filters.push({ 'serialNumber': serial });
                } else if (vid) {
                    filters.push({ 'vendorId': vid });
                }
                navigator.usb.requestDevice({ 'filters': filters }).then(
                    async selectedDevice => {
                        let interfaces = dfu.findDeviceDfuInterfaces(selectedDevice);
                        if (interfaces.length == 0) {
                            console.log(selectedDevice);
                            //   statusDisplay.textContent = "The selected device does not have any USB DFU interfaces.";
                        } else if (interfaces.length == 1) {
                            await fixInterfaceNames(selectedDevice, interfaces);
                            device = await connect(new dfu.Device(selectedDevice, interfaces[0]));
                            // } else {
                            //     await fixInterfaceNames(selectedDevice, interfaces);
                            //     populateInterfaceList(interfaceForm, selectedDevice, interfaces);
                            //     async function connectToSelectedInterface() {
                            //         interfaceForm.removeEventListener('submit', this);
                            //         const index = interfaceForm.elements["interfaceIndex"].value;
                            //         device = await connect(new dfu.Device(selectedDevice, interfaces[index]));
                            //     }

                            // interfaceForm.addEventListener('submit', connectToSelectedInterface);

                            // interfaceDialog.addEventListener('cancel', function () {
                            //     interfaceDialog.removeEventListener('cancel', this);
                            //     interfaceForm.removeEventListener('submit', connectToSelectedInterface);
                            // });

                            // interfaceDialog.showModal();
                        }
                    }
                ).catch(error => {
                    //    statusDisplay.textContent = error;
                });
            }
        });
        // 监听dfuseUploadSize的变化   暂不使用
        // detachButton.addEventListener('click', function () {
        //     console.log("detach button clicked");
        //     if (device) {
        //         device.detach().then(
        //             async len => {
        //                 let detached = false;
        //                 try {
        //                     await device.close();
        //                     await device.waitDisconnected(5000);
        //                     detached = true;
        //                 } catch (err) {
        //                     console.log("Detach failed: " + err);
        //                 }

        //                 onDisconnect();
        //                 device = null;
        //                 if (detached) {
        //                     // Wait a few seconds and try reconnecting
        //                     setTimeout(autoConnect, 5000);
        //                 }
        //             },
        //             async error => {
        //                 await device.close();
        //                 onDisconnect(error);
        //                 device = null;
        //             }
        //         );
        //     }
        // });
        //  监听uploadButton的变化  从设备获取dfu文件 暂不使用
        // uploadButton.addEventListener('click', async function (event) {
        //     console.log("upload button clicked");
        //     event.preventDefault();
        //     event.stopPropagation();
        //     if (!configForm.checkValidity()) {
        //         configForm.reportValidity();
        //         return false;
        //     }

        //     if (!device || !device.device_.opened) {
        //         onDisconnect();
        //         device = null;
        //     } else {
        //         setLogContext(uploadLog);
        //         clearLog(uploadLog);
        //         try {
        //             let status = await device.getStatus();
        //             if (status.state == dfu.dfuERROR) {
        //                 await device.clearStatus();
        //             }
        //         } catch (error) {
        //             device.logWarning("Failed to clear status");
        //         }

        //         let maxSize = Infinity;
        //         if (!dfuseUploadSizeField.disabled) {
        //             maxSize = parseInt(dfuseUploadSizeField.value);
        //         }

        //         try {
        //             const blob = await device.do_upload(transferSize, maxSize);
        //             saveAs(blob, "firmware.bin");
        //         } catch (error) {
        //             logError(error);
        //         }

        //         setLogContext(null);
        //     }

        //     return false;
        // });
        // 监听firmwareFileField的变化    读取dfu文件
        firmwareFileField.addEventListener("change", function () {
            console.log("firmwareFileField changed");
            firmwareFile = null;
            if (firmwareFileField.files.length > 0) {
                let file = firmwareFileField.files[0];
                let reader = new FileReader();
                reader.onload = function () {
                    firmwareFile = reader.result;
                };
                reader.readAsArrayBuffer(file);
                console.log("读取到的信息是：", firmwareFile, file);
            }
        });
        async function downloadFileFromUrl(url) {
            try {
                const response = await fetch(url);
                // 代理示例（需部署到同源服务器）
                // const response = await fetch(`https://guangyanjiaohu.com?url=${encodeURIComponent(url)}`);
                //const response = await fetch(url, { mode: 'no-cors' });


                console.log("111")
                if (!response.ok) throw new Error('网络请求失败');
                const blob = await response.blob(); // 将响应转换为Blob对象
                let file = blob;
                firmwareFile = null;
                let reader = new FileReader();
                reader.onload = function () {
                    firmwareFile = reader.result;
                };
                reader.readAsArrayBuffer(file);
                console.log("网络读取到的信息是：", firmwareFile, file);

                return blob;
            } catch (error) {
                console.error('下载失败:', error);
            }
        }




        //dfu 更新按钮  主要更新函数
        downloadButton.addEventListener('click', async function (event) {
            console.log("downloadButton clicked");
            event.preventDefault();
            event.stopPropagation();


            if (device && firmwareFile != null) {
                console.log("开始更新");
                //    setLogContext(downloadLog);
                //    clearLog(downloadLog);
                try {
                    let status = await device.getStatus();
                    if (status.state == dfu.dfuERROR) {
                        await device.clearStatus();
                    }
                } catch (error) {
                    device.logWarning("Failed to clear status");
                }
                console.log("开始更新2");
                let transferSize = 1024;
                await device.do_download(transferSize, firmwareFile, manifestationTolerant).then(
                    () => {
                        logInfo("Done!");
                        setLogContext(null);
                        //
                        if (!manifestationTolerant) {
                            device.waitDisconnected(5000).then(
                                dev => {
                                    onDisconnect();
                                    device = null;
                                },
                                error => {
                                    // It didn't reset and disconnect for some reason...
                                    console.log("Device unexpectedly tolerated manifestation.");
                                }
                            );
                        }
                    },
                    error => {
                        //
                        console.log("更新失败,报错");
                        logError(error);
                        setLogContext(null);
                    }
                )
            }

            //return false;
        });

        // Check if WebUSB is available
        //断开连接  保留
        if (typeof navigator.usb !== 'undefined') {
            console.log("断开连接？")
            navigator.usb.addEventListener("disconnect", onUnexpectedDisconnect);
            // Try connecting automatically
            if (fromLandingPage) {
                //     autoConnect(vid, serial);
            }
        } else {
            //    statusDisplay.textContent = 'WebUSB not available.'
            connectButton.disabled = true;
        }
    });
})();
