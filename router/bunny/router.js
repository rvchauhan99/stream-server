
const  controller = require('../../controller/bunny/controller')    
const express = require('express')
const app = express()

app.get('/',(req,res)=>{
  controller.getAllVideos().then((data)=>{
    res.send(data)
  })
})
app.get('/video/:id',(req,res)=>{
  controller.getVideoById(req.params.id).then((data)=>{
    res.send(data)
  })
})
app.delete('/video/:id',(req,res)=>{
  controller.deleteVideo(req.params.id).then((data)=>{
    res.send(data)
  })
})
app.put('/video/:id',(req,res)=>{
  controller.updateVideo(req.params.id,req.body).then((data)=>{
    res.send(data)
  })
})
app.get('/video/:id/resolutions',(req,res)=>{
  controller.getVideoResolutions(req.params.id).then((data)=>{
    res.send(data)
  })
})
app.get('/video/:id/thumbnails',(req,res)=>{
  controller.getThumbnails(req.params.id).then((data)=>{
    res.send(data)
  })
})

app.get('/video/:id/getSecurePlaybackUrl',(req,res)=>{
    controller.getSecurePlaybackUrl(req.params.id ,  3600).then((data)=>{
      res.send(data)
    })
})
module.exports = app