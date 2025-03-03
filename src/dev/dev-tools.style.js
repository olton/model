const DevToolsStyle = `
    <style>
        #model-devtools-panel  { 
            position: fixed;
            bottom: 0;
            right: 0;
            width: 300px;
            height: 400px;
            background: #242424;
            color: #fff;
            border: 1px solid #333;
            z-index: 9999;
            font-family: monospace;
            
            *::-webkit-scrollbar {
              width: 10px;
            }
            
            * {
              scrollbar-width: thin;
            }
            
            .devtools-section {
                padding: 8px;
                margin: 4px;
                border: 1px solid #444;
                cursor: pointer;
                hover: background-color: #333;
                font-size: 12px;
            }
            
            h3 {
                margin: 0;
                font-size: 14px;
                border-bottom: 1px solid #333;
                padding-bottom: 4px;
            }
        }
        
        #model-dev-tools-toggle-button {
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 9998;
            height: 36px;
            width: 36px;
            background: #444;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }        

        #model-devtools-time-travel-dialog {
            position: fixed;
            bottom: 0;
            right: 304px;
            background: #2a2a2a;
            border: 1px solid #444;
            border-radius: 4px;
            height: 400px;
            width: 300px;
            z-index: 10000;
            color: #fff;
            font-family: monospace;
            
            *::-webkit-scrollbar {
              width: 10px;
            }
            
            * {
              scrollbar-width: thin;
            }
            
            .time-travel-items {
                padding: 4px; 
                height: calc(100% - 35px); 
                overflow: auto;
                position: relative;
            }
            
            .time-travel-item {
                padding: 8px;
                margin: 4px;
                border: 1px solid #444;
                cursor: pointer;
                hover: background-color: #333;
                font-size: 12px;
                
                button {
                    margin-top: 8px;
                    background: dodgerblue;
                }
            }
        }
        
        #model-devtools-panel, #model-devtools-time-travel-dialog {
            button {
                height: 20px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                border-radius: 4px;
                border: 1px solid #444;
                background: #333;
                color: #fff;
                cursor: pointer;
                
                @media (hover: hover) {
                    &:hover {
                        background: #444;
                    }
                }

                @media (hover: none) {
                    &:hover {
                        background: #444;
                    }
                }
            }        
        }
        
        .dev-tools-header {
            padding: 8px; 
            border-bottom: 1px solid #333; 
            display: flex; 
            justify-content: space-between;
        }
    </style>
`

export default DevToolsStyle