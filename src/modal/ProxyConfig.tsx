import { Box, Button, Modal } from '@mui/material';
import { TextValidator, ValidatorForm } from 'react-material-ui-form-validator';
import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import { useImmer } from 'use-immer';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

export interface ProxyConfigHandler{
  open: ()=>void
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ProxyConfigProps{

}

const ProxyConfig = (props: ProxyConfigProps, ref: React.Ref<ProxyConfigHandler>)=>{
  const [apiConfigModal, setApiConfigModal] = useImmer<{isOpen:boolean, config: ApiConfig, proxy: string}>({
    isOpen:false,
    config: {
      baseUrl:'',
      apiKey:'',
      ernie: true
    },
    proxy:''
  })
  async function getProxyConfig(){
    return window.chatBot.requestGetChatConfig().then(config=>{
      setApiConfigModal(draft => {
        draft.config = config
      })
    })
  }

  useEffect(() => {
    window.chatBot.onProxyChange(()=>{
      getProxyConfig().then(()=>{
        setApiConfigModal(draft => {
          draft.isOpen = true
        })
      })
    })
  }, []);
  useEffect(()=>{
    if(apiConfigModal.isOpen){
      getProxyConfig().then()
    }
  }, [apiConfigModal.isOpen])
  useImperativeHandle(ref, ()=>{
    return {
      open: ()=>{
        setApiConfigModal(draft => {
          draft.isOpen = true
        })
      }
    }
  } , [apiConfigModal])
  return (
    <Modal
      open={apiConfigModal.isOpen}
      onClose={()=>{
        setApiConfigModal(draft => {
          draft.isOpen = false
        })
      }}
    >
      <Box sx={modalStyle}>
        <ValidatorForm onSubmit={e=>{
          e.preventDefault()
          window.chatBot.replyProxy(apiConfigModal.proxy).then(()=>{
            setApiConfigModal(draft => {
              draft.isOpen = false
            })
          })
        }}>
          <TextValidator
            name={'proxy'}
            value={apiConfigModal.proxy}
            label="proxy config eg: http://127.0.0.1:7890"
            style={{width: '100%', marginBottom: '20px'}}
            size={"small"}
            onChange={e=> {
              setApiConfigModal(draft => {
                draft.proxy = (e.target as HTMLInputElement).value
              })
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button type={'submit'} variant="contained" color="primary">
              确认
            </Button>
          </Box>
        </ValidatorForm>
      </Box>
    </Modal>
  )
}
export default forwardRef<ProxyConfigHandler, ProxyConfigProps>(ProxyConfig)
