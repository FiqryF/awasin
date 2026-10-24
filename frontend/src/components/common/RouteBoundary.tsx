import { Component, type ContextType, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AuthContext } from '../../features/auth/context'

export class RouteBoundary extends Component<Readonly<{children:ReactNode;resetKey:string;inLayout?:boolean}>,{failed:boolean}> {
  static readonly contextType=AuthContext
  declare context:ContextType<typeof AuthContext>
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(){document.title='Halaman belum dapat dibuka | AWASIN'}
  componentDidUpdate(previous:Readonly<{resetKey:string}>){
    if(previous.resetKey!==this.props.resetKey&&this.state.failed)this.setState({failed:false})
  }
  render(){
    if(!this.state.failed)return this.props.children
    const Container=this.props.inLayout?'section':'main'
    return <Container className="route-error" role="alert"><h1>Halaman belum dapat dibuka.</h1><p>Periksa koneksi, lalu muat ulang halaman. Jangan menganggap tindakan yang belum dikonfirmasi sudah berhasil.</p><button type="button" className="button button-red" onClick={()=>window.location.reload()}>Muat ulang halaman</button><Link to={this.context.identity?'/dashboard':'/'} className="auth-link">Kembali ke beranda</Link></Container>
  }
}
